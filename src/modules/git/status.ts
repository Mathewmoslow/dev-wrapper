import { simpleGit, SimpleGit, StatusResult } from 'simple-git';
import type { GitStatus, GitCommit } from '../../types/index.js';

function getGit(cwd?: string): SimpleGit {
  return simpleGit(cwd || process.cwd());
}

export async function isGitRepo(cwd?: string): Promise<boolean> {
  try {
    const git = getGit(cwd);
    await git.status();
    return true;
  } catch {
    return false;
  }
}

export async function getGitStatus(cwd?: string): Promise<GitStatus> {
  const git = getGit(cwd);

  try {
    const status: StatusResult = await git.status();

    return {
      branch: status.current || 'unknown',
      isClean: status.isClean(),
      modified: status.modified,
      staged: status.staged,
      untracked: status.not_added,
      ahead: status.ahead,
      behind: status.behind,
    };
  } catch (error) {
    // Not a git repo or git error
    return {
      branch: 'not a git repo',
      isClean: true,
      modified: [],
      staged: [],
      untracked: [],
      ahead: 0,
      behind: 0,
    };
  }
}

export async function getRecentCommits(count: number = 20, cwd?: string): Promise<GitCommit[]> {
  const git = getGit(cwd);

  try {
    const log = await git.log({ maxCount: count });

    return log.all.map((commit) => ({
      hash: commit.hash.substring(0, 7),
      message: commit.message,
      date: new Date(commit.date),
      author: commit.author_name,
    }));
  } catch {
    return [];
  }
}

export async function getCurrentBranch(cwd?: string): Promise<string> {
  const git = getGit(cwd);

  try {
    const branch = await git.branch();
    return branch.current;
  } catch {
    return 'unknown';
  }
}

export async function stageAll(cwd?: string): Promise<void> {
  const git = getGit(cwd);
  await git.add('-A');
}

export async function commit(message: string, cwd?: string): Promise<string> {
  const git = getGit(cwd);
  const result = await git.commit(message);
  return result.commit;
}

export async function push(cwd?: string): Promise<void> {
  const git = getGit(cwd);
  await git.push();
}

export async function autoCommit(prefix: string = 'checkpoint', cwd?: string): Promise<string | null> {
  const status = await getGitStatus(cwd);

  if (status.isClean) {
    return null; // Nothing to commit
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const message = `${prefix}: ${timestamp}`;

  await stageAll(cwd);
  return await commit(message, cwd);
}
