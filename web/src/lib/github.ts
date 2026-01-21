import { Octokit } from '@octokit/rest';
import type { GitHubRepo, GitHubCommit, GitHubFile } from './types';

export class GitHubClient {
  private octokit: Octokit;
  private owner: string = '';
  private repo: string = '';

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  setRepo(fullName: string) {
    const [owner, repo] = fullName.split('/');
    this.owner = owner;
    this.repo = repo;
  }

  // Get authenticated user
  async getUser(): Promise<{ login: string; name: string; avatar_url: string }> {
    const { data } = await this.octokit.users.getAuthenticated();
    return {
      login: data.login,
      name: data.name || data.login,
      avatar_url: data.avatar_url,
    };
  }

  // List user repos
  async listRepos(): Promise<GitHubRepo[]> {
    const { data } = await this.octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100,
    });

    return data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      default_branch: repo.default_branch || 'main',
      html_url: repo.html_url,
    }));
  }

  // Get repo contents (files in a path)
  async getContents(path: string = ''): Promise<GitHubFile[]> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
      });

      if (Array.isArray(data)) {
        return data.map((item) => ({
          name: item.name,
          path: item.path,
          sha: item.sha,
          size: item.size,
          type: item.type as 'file' | 'dir',
        }));
      }

      // Single file
      return [{
        name: data.name,
        path: data.path,
        sha: data.sha,
        size: data.size,
        type: data.type as 'file' | 'dir',
        content: 'content' in data ? atob(data.content) : undefined,
      }];
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        return [];
      }
      throw error;
    }
  }

  // Get file content
  async getFileContent(path: string): Promise<string> {
    const { data } = await this.octokit.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path,
    });

    if (Array.isArray(data)) {
      throw new Error('Path is a directory, not a file');
    }

    if (!('content' in data)) {
      throw new Error('File content not available');
    }

    return atob(data.content);
  }

  // Create or update file
  async createOrUpdateFile(
    path: string,
    content: string,
    message: string,
    sha?: string
  ): Promise<GitHubCommit> {
    // If no SHA provided, try to get existing file SHA
    let existingSha = sha;
    if (!existingSha) {
      try {
        const { data } = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path,
        });
        if (!Array.isArray(data)) {
          existingSha = data.sha;
        }
      } catch {
        // File doesn't exist, that's fine
      }
    }

    const { data } = await this.octokit.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      path,
      message,
      content: btoa(content),
      sha: existingSha,
    });

    return {
      sha: data.commit.sha || '',
      message: data.commit.message || message,
      author: {
        name: data.commit.author?.name || 'Unknown',
        date: data.commit.author?.date || new Date().toISOString(),
      },
    };
  }

  // Delete file
  async deleteFile(path: string, message: string): Promise<void> {
    // Get file SHA first
    const { data } = await this.octokit.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path,
    });

    if (Array.isArray(data)) {
      throw new Error('Cannot delete directory');
    }

    await this.octokit.repos.deleteFile({
      owner: this.owner,
      repo: this.repo,
      path,
      message,
      sha: data.sha,
    });
  }

  // List commits
  async listCommits(perPage: number = 20): Promise<GitHubCommit[]> {
    const { data } = await this.octokit.repos.listCommits({
      owner: this.owner,
      repo: this.repo,
      per_page: perPage,
    });

    return data.map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: {
        name: commit.commit.author?.name || 'Unknown',
        date: commit.commit.author?.date || '',
      },
    }));
  }

  // Create branch
  async createBranch(name: string, fromBranch?: string): Promise<void> {
    // Get the SHA of the branch to branch from
    const baseBranch = fromBranch || (await this.getDefaultBranch());
    const { data: ref } = await this.octokit.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${baseBranch}`,
    });

    await this.octokit.git.createRef({
      owner: this.owner,
      repo: this.repo,
      ref: `refs/heads/${name}`,
      sha: ref.object.sha,
    });
  }

  // Get default branch
  async getDefaultBranch(): Promise<string> {
    const { data } = await this.octokit.repos.get({
      owner: this.owner,
      repo: this.repo,
    });
    return data.default_branch;
  }

  // Create pull request
  async createPullRequest(
    title: string,
    body: string,
    head: string,
    base?: string
  ): Promise<{ number: number; html_url: string }> {
    const baseBranch = base || (await this.getDefaultBranch());

    const { data } = await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body,
      head,
      base: baseBranch,
    });

    return {
      number: data.number,
      html_url: data.html_url,
    };
  }

  // Create repo
  async createRepo(
    name: string,
    isPrivate: boolean = true,
    description?: string
  ): Promise<GitHubRepo> {
    const { data } = await this.octokit.repos.createForAuthenticatedUser({
      name,
      private: isPrivate,
      description,
      auto_init: true,
    });

    return {
      id: data.id,
      name: data.name,
      full_name: data.full_name,
      private: data.private,
      default_branch: data.default_branch || 'main',
      html_url: data.html_url,
    };
  }
}

// GitHub OAuth helpers
const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';

export function getGitHubAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'repo user',
  });

  return `https://github.com/login/oauth/authorize?${params}`;
}

// Note: GitHub OAuth requires a backend to exchange code for token
// For a fully static site, you'd need to use a serverless function or
// GitHub Apps with device flow
