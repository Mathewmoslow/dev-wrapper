import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { simpleGit } from 'simple-git';

export interface ProjectSetupOptions {
  projectName: string;
  githubUsername: string;
  createDirectory: boolean;
  baseDirectory?: string;
}

export interface SetupResult {
  success: boolean;
  projectPath: string;
  gitInitialized: boolean;
  remoteAdded: boolean;
  vercelLinked: boolean;
  errors: string[];
}

export async function setupProject(options: ProjectSetupOptions): Promise<SetupResult> {
  const { projectName, githubUsername, createDirectory, baseDirectory = process.cwd() } = options;
  const errors: string[] = [];

  let projectPath = baseDirectory;
  let gitInitialized = false;
  let remoteAdded = false;
  let vercelLinked = false;

  // Step 1: Create directory if needed
  if (createDirectory) {
    projectPath = path.join(baseDirectory, projectName);
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }
  }

  const git = simpleGit(projectPath);

  // Step 2: Git init
  try {
    const isRepo = fs.existsSync(path.join(projectPath, '.git'));
    if (!isRepo) {
      await git.init();
    }
    gitInitialized = true;
  } catch (err) {
    errors.push(`Git init failed: ${err}`);
  }

  // Step 3: Add GitHub remote
  try {
    const remoteUrl = `https://github.com/${githubUsername}/${projectName}.git`;
    const remotes = await git.getRemotes();
    const hasOrigin = remotes.some((r) => r.name === 'origin');

    if (hasOrigin) {
      await git.remote(['set-url', 'origin', remoteUrl]);
    } else {
      await git.addRemote('origin', remoteUrl);
    }
    remoteAdded = true;
  } catch (err) {
    errors.push(`GitHub remote failed: ${err}`);
  }

  // Step 4: Create basic .gitignore if it doesn't exist
  const gitignorePath = path.join(projectPath, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, getDefaultGitignore());
  }

  return {
    success: errors.length === 0,
    projectPath,
    gitInitialized,
    remoteAdded,
    vercelLinked, // Will be set by the interactive vercel link step
    errors,
  };
}

// Cross-platform command existence check
function commandExists(cmd: string): boolean {
  try {
    const checkCmd = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`;
    execSync(checkCmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Run vercel link interactively - synchronous to properly capture stdin
export function runVercelLink(projectPath: string): boolean {
  if (!commandExists('vercel')) {
    return false;
  }

  try {
    const isWindows = process.platform === 'win32';
    const result = spawnSync(isWindows ? 'vercel.cmd' : 'vercel', ['link'], {
      cwd: projectPath,
      stdio: 'inherit',
      shell: true,
    });

    return result.status === 0;
  } catch {
    return false;
  }
}

export function isEmptyDirectory(dir: string): boolean {
  if (!fs.existsSync(dir)) return true;
  const files = fs.readdirSync(dir);
  // Ignore hidden files and common non-project files
  const projectFiles = files.filter((f) => !f.startsWith('.') && f !== 'node_modules');
  return projectFiles.length === 0;
}

export function isVercelInstalled(): boolean {
  return commandExists('vercel');
}

export function getGitHubUsernameFromGit(): string | null {
  try {
    const url = execSync('git config --get remote.origin.url', { encoding: 'utf-8' }).trim();
    // Parse username from URL like https://github.com/username/repo.git or git@github.com:username/repo.git
    const match = url.match(/github\.com[:/]([^/]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function getDefaultGitignore(): string {
  return `# Dependencies
node_modules/

# Build output
dist/
build/
.next/
out/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Vercel
.vercel

# Testing
coverage/
`;
}
