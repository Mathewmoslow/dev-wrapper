#!/usr/bin/env node
import React, { useState } from 'react';
import { render, Box, Text, useInput } from 'ink';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { spawn, execSync } from 'child_process';
import { Chat } from './components/Chat.js';
import { parseCliArgs } from './cli.js';
import { loadConfig } from './core/config.js';
import { installCommitMsgHook, isGitRepo, getGitStatus } from './modules/git/index.js';
import { getConfiguredProviders } from './providers/index.js';
import { setupProject, isVercelInstalled, isEmptyDirectory } from './modules/setup/index.js';
import type { ProviderName } from './providers/types.js';
import { colors } from './theme.js';

// Load env vars from .env.local if exists
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (key && value && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

// Load API keys from shell profile files (cross-platform)
function loadShellEnv() {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const isWindows = process.platform === 'win32';

  const keyPatterns = [
    'ANTHROPIC_API_KEY',
    'CLAUDE_API_KEY',
    'OPENAI_API_KEY',
    'OPENAI_API_KEY_CONTEXT',
    'GEMINI_API_KEY',
    'GOOGLE_API_KEY',
  ];

  // Unix profiles
  const unixProfiles = [
    path.join(home, '.bashrc'),
    path.join(home, '.bash_profile'),
    path.join(home, '.zshrc'),
    path.join(home, '.zprofile'),
  ];

  // Windows PowerShell profiles
  const windowsProfiles = [
    path.join(home, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1'),
    path.join(home, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1'),
    path.join(home, '.config', 'powershell', 'Microsoft.PowerShell_profile.ps1'),
  ];

  const profiles = isWindows ? [...windowsProfiles, ...unixProfiles] : unixProfiles;

  for (const profile of profiles) {
    if (fs.existsSync(profile)) {
      const content = fs.readFileSync(profile, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();

        // Unix: export KEY=value
        if (trimmed.startsWith('export ')) {
          const exportLine = trimmed.slice(7);
          const eqIndex = exportLine.indexOf('=');
          if (eqIndex > 0) {
            const key = exportLine.slice(0, eqIndex);
            const value = exportLine.slice(eqIndex + 1).replace(/^["']|["']$/g, '');
            if (keyPatterns.includes(key) && value && !process.env[key]) {
              process.env[key] = value;
            }
          }
        }

        // PowerShell: $env:KEY = "value"
        const psMatch = trimmed.match(/^\$env:([A-Z_]+)\s*=\s*["']?([^"']+)["']?/i);
        if (psMatch) {
          const [, key, value] = psMatch;
          if (keyPatterns.includes(key) && value && !process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
  }
}

// Simple CLI prompts (before Ink takes over)
async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await prompt(`${question} ${hint} `);
  if (!answer) return defaultYes;
  return answer.toLowerCase() === 'y';
}

// Check if gh CLI is installed and authenticated
function isGhInstalled(): boolean {
  try {
    execSync('gh auth status', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Get GitHub username from gh CLI
function getGhUsername(): string | null {
  try {
    const result = execSync('gh api user --jq .login', { encoding: 'utf-8' }).trim();
    return result || null;
  } catch {
    return null;
  }
}

// Run interactive setup BEFORE Ink - FULLY AUTOMATED
async function runSetupWizard(baseDir: string): Promise<string | null> {
  const isWindows = process.platform === 'win32';

  console.log('\n\x1b[34m📦 NEW PROJECT SETUP (Automated)\x1b[0m');
  console.log('\x1b[90m─────────────────────────────────────\x1b[0m\n');

  // Step 1: Check prerequisites
  const hasGh = isGhInstalled();
  const hasVercel = isVercelInstalled();

  console.log('\x1b[90mChecking tools...\x1b[0m');
  console.log(`  GitHub CLI (gh): ${hasGh ? '\x1b[32m✓ authenticated\x1b[0m' : '\x1b[31m✗ not found or not authenticated\x1b[0m'}`);
  console.log(`  Vercel CLI:      ${hasVercel ? '\x1b[32m✓ installed\x1b[0m' : '\x1b[33m⚠ not found (optional)\x1b[0m'}`);

  if (!hasGh) {
    console.log('\n\x1b[31mError: GitHub CLI required for automated setup.\x1b[0m');
    console.log('\x1b[90mInstall: https://cli.github.com then run: gh auth login\x1b[0m\n');
    return null;
  }

  // Step 2: Get GitHub username automatically
  const githubUser = getGhUsername();
  if (!githubUser) {
    console.log('\n\x1b[31mError: Could not get GitHub username. Run: gh auth login\x1b[0m');
    return null;
  }
  console.log(`  GitHub user:     \x1b[32m${githubUser}\x1b[0m\n`);

  // Step 3: Get project name
  const projectName = await prompt('Project name: ');
  if (!projectName) {
    console.log('\x1b[31mError: Project name is required\x1b[0m');
    return null;
  }

  const createDir = await confirm(`Create new directory './${projectName}'?`, true);
  const makePrivate = await confirm('Make repository private?', true);

  console.log('\n\x1b[90m─────────────────────────────────────\x1b[0m');
  console.log('\x1b[34mRunning automated setup...\x1b[0m\n');

  // Step 4: Create directory
  let projectPath = baseDir;
  if (createDir) {
    projectPath = path.join(baseDir, projectName);
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }
  }
  console.log(`\x1b[32m✓ Directory: ${projectPath}\x1b[0m`);

  // Step 5: Git init
  try {
    execSync('git init', { cwd: projectPath, stdio: 'ignore' });
    console.log('\x1b[32m✓ Git initialized\x1b[0m');
  } catch (err) {
    console.log(`\x1b[31m✗ Git init failed: ${err}\x1b[0m`);
    return null;
  }

  // Step 6: Create .gitignore
  const gitignorePath = path.join(projectPath, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, `node_modules/
dist/
build/
.next/
.env
.env.local
.env.*.local
.DS_Store
.vercel
coverage/
*.log
`);
    console.log('\x1b[32m✓ Created .gitignore\x1b[0m');
  }

  // Step 7: Create README
  const readmePath = path.join(projectPath, 'README.md');
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, `# ${projectName}\n\nCreated with studiora-dev\n`);
    console.log('\x1b[32m✓ Created README.md\x1b[0m');
  }

  // Step 8: Initial commit (REQUIRED before gh repo create)
  try {
    execSync('git add -A', { cwd: projectPath, stdio: 'ignore' });
    execSync('git commit -m "Initial commit"', { cwd: projectPath, stdio: 'ignore' });
    console.log('\x1b[32m✓ Initial commit created\x1b[0m');
  } catch (err) {
    console.log(`\x1b[31m✗ Commit failed: ${err}\x1b[0m`);
    return null;
  }

  // Step 9: Create GitHub repo and push (gh repo create does it all)
  let actualRepoUrl = '';
  let actualRepoName = '';
  try {
    const visibility = makePrivate ? '--private' : '--public';
    const cmd = `gh repo create ${projectName} ${visibility} --source=. --push`;
    console.log('\x1b[90m→ Creating GitHub repository...\x1b[0m');
    execSync(cmd, { cwd: projectPath, stdio: 'inherit' });

    // Wait for GitHub to propagate
    console.log('\x1b[90m→ Waiting for GitHub to sync...\x1b[0m');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get the ACTUAL repo info from GitHub API (correct casing and URL)
    try {
      const repoInfo = execSync('gh repo view --json nameWithOwner,url', {
        cwd: projectPath,
        encoding: 'utf-8',
      });
      const parsed = JSON.parse(repoInfo);
      actualRepoName = parsed.nameWithOwner; // e.g., "Mathewmoslow/MyRepo"
      actualRepoUrl = parsed.url; // e.g., "https://github.com/Mathewmoslow/MyRepo"
      console.log(`\x1b[32m✓ GitHub repo created: ${actualRepoUrl}\x1b[0m`);

      // Ensure remote is set to HTTPS URL (not SSH)
      execSync(`git remote set-url origin ${actualRepoUrl}.git`, {
        cwd: projectPath,
        stdio: 'ignore',
      });
    } catch {
      actualRepoUrl = `https://github.com/${githubUser}/${projectName}`;
      actualRepoName = `${githubUser}/${projectName}`;
      console.log(`\x1b[32m✓ GitHub repo created: ${actualRepoUrl}\x1b[0m`);
    }
  } catch (err) {
    console.log(`\x1b[31m✗ GitHub repo creation failed: ${err}\x1b[0m`);
    console.log('\x1b[90mYou can create it manually at https://github.com/new\x1b[0m');
  }

  // Show completion summary FIRST
  console.log('\n\x1b[32m✅ CORE SETUP COMPLETE!\x1b[0m');
  console.log('\x1b[90m─────────────────────────────────────\x1b[0m');
  console.log(`\x1b[32m✓\x1b[0m Local project: ${projectPath}`);
  console.log(`\x1b[32m✓\x1b[0m GitHub repo:   ${actualRepoUrl || `https://github.com/${githubUser}/${projectName}`}`);
  console.log('');

  // Step 10: Vercel link as OPTIONAL FINAL STEP (interactive)
  if (hasVercel) {
    const doVercel = await confirm('Run Vercel setup? (interactive)', true);
    if (doVercel) {
      console.log('\n\x1b[34m📦 VERCEL SETUP\x1b[0m');
      console.log('\x1b[90m─────────────────────────────────────\x1b[0m');
      console.log('\x1b[90mAnswer the prompts below.\x1b[0m');
      console.log('\x1b[90mWhen asked "Connect to GitHub?" → say YES\x1b[0m\n');

      // Run interactive vercel link (no --yes, user sees all prompts)
      await new Promise<void>((resolve) => {
        const vercel = spawn(isWindows ? 'vercel.cmd' : 'vercel', ['link'], {
          cwd: projectPath,
          stdio: 'inherit',
          shell: true,
        });
        vercel.on('close', () => resolve());
        vercel.on('error', () => resolve());
      });

      console.log('\n\x1b[32m✓ Vercel setup complete\x1b[0m');
    }
  }

  console.log('');

  return projectPath;
}

// Main App component
interface AppState {
  provider: ProviderName;
  contextPercentage: number;
  gitBranch: string;
  gitClean: boolean;
  isRepo: boolean;
}

function App({ directory, skipStartup }: { directory: string; skipStartup: boolean }) {
  // Get configured providers synchronously
  const configuredProviders = getConfiguredProviders();

  const [view, setView] = useState<'startup' | 'chat'>('startup');
  const [state, setState] = useState<AppState>({
    provider: null as unknown as ProviderName, // No default - user must choose
    contextPercentage: 0,
    gitBranch: 'unknown',
    gitClean: true,
    isRepo: false,
  });

  const [providers, setProviders] = useState<string[]>(configuredProviders.map(p => p.name));
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1); // -1 = none selected
  const [gitInfo, setGitInfo] = useState({ isRepo: false, branch: '', hookInstalled: false });

  // Load git state on mount
  React.useEffect(() => {
    async function init() {
      const repo = await isGitRepo();
      if (repo) {
        const status = await getGitStatus();
        const { isHookInstalled } = await import('./modules/git/index.js');
        let hookInstalled = isHookInstalled();
        if (!hookInstalled) {
          await installCommitMsgHook();
          hookInstalled = true;
        }
        setGitInfo({ isRepo: true, branch: status.branch, hookInstalled });
        setState((s) => ({ ...s, isRepo: true, gitBranch: status.branch, gitClean: status.isClean }));
      }
      setLoading(false);
    }
    init();
  }, []);

  useInput((input, key) => {
    if (view === 'startup' && !loading && providers.length > 0) {
      // Arrow keys or j/k for navigation
      if (key.upArrow || input === 'k') {
        setSelectedIndex((i) => (i <= 0 ? providers.length - 1 : i - 1));
      } else if (key.downArrow || input === 'j') {
        setSelectedIndex((i) => (i >= providers.length - 1 ? 0 : i + 1));
      }
      // Number keys for direct selection
      else if (input === '1' && providers.length >= 1) {
        setSelectedIndex(0);
      } else if (input === '2' && providers.length >= 2) {
        setSelectedIndex(1);
      } else if (input === '3' && providers.length >= 3) {
        setSelectedIndex(2);
      }
      // Enter to confirm (only if provider selected)
      else if (key.return && selectedIndex >= 0) {
        setState((s) => ({ ...s, provider: providers[selectedIndex] as ProviderName }));
        setView('chat');
      }
    }
  });

  const projectName = directory.split('/').pop() || directory;

  // Startup view
  if (view === 'startup') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Box>
          <Text color={colors.primary} bold>STUDIORA DEV</Text>
          <Text color={colors.dim}>  →  </Text>
          <Text color={colors.accent}>{projectName}</Text>
        </Box>
        <Text> </Text>
        <Text color={colors.muted}>Preflight</Text>
        <Text color={colors.dim}>{'─'.repeat(60)}</Text>
        <Text> </Text>

        <Box>
          <Text color={gitInfo.isRepo ? colors.success : colors.warning}>
            {loading ? '[....]' : gitInfo.isRepo ? '[done]' : '[warn]'}
          </Text>
          <Text>  </Text>
          <Box width={20}><Text color={colors.secondary}>Git status</Text></Box>
          <Text color={colors.primary}>
            {loading ? 'checking...' : gitInfo.isRepo ? gitInfo.branch : 'not a git repo'}
          </Text>
        </Box>

        <Box>
          <Text color={!gitInfo.isRepo ? colors.muted : gitInfo.hookInstalled ? colors.success : colors.muted}>
            {loading ? '[....]' : !gitInfo.isRepo ? '[skip]' : '[done]'}
          </Text>
          <Text>  </Text>
          <Box width={20}><Text color={colors.secondary}>AI signature hook</Text></Box>
          <Text color={colors.primary}>
            {!gitInfo.isRepo ? 'n/a' : gitInfo.hookInstalled ? 'installed' : 'pending'}
          </Text>
        </Box>

        <Box>
          <Text color={providers.length > 0 ? colors.success : colors.error}>
            {loading ? '[....]' : providers.length > 0 ? '[done]' : '[fail]'}
          </Text>
          <Text>  </Text>
          <Box width={20}><Text color={colors.secondary}>AI Providers</Text></Box>
          <Text color={colors.primary}>
            {loading ? 'checking...' : providers.length > 0 ? providers.join(', ') : 'none configured'}
          </Text>
        </Box>

        <Text> </Text>

        {!loading && providers.length > 0 && (
          <Box flexDirection="column">
            <Text color={colors.accent} bold>Choose AI Provider:</Text>
            <Text color={colors.muted}>(↑/↓ or 1-3 to select, Enter to confirm)</Text>
            <Text> </Text>
            {providers.map((p, i) => (
              <Box key={p}>
                <Text color={i === selectedIndex ? colors.accent : colors.dim}>
                  {i === selectedIndex ? '▸ ' : '  '}
                </Text>
                <Text color={i === selectedIndex ? colors.accent : colors.secondary}>
                  [{i + 1}] {p}
                </Text>
                {i === selectedIndex && (
                  <Text color={colors.success}> ✓</Text>
                )}
              </Box>
            ))}
          </Box>
        )}

        <Text> </Text>
        {!loading && providers.length > 0 && selectedIndex >= 0 && (
          <Box borderStyle="single" borderColor={colors.accent} paddingX={1}>
            <Text color={colors.secondary}>Press </Text>
            <Text color={colors.accent}>Enter</Text>
            <Text color={colors.secondary}> to start with </Text>
            <Text color={colors.accent} bold>{providers[selectedIndex]}</Text>
          </Box>
        )}
        {!loading && providers.length > 0 && selectedIndex < 0 && (
          <Box borderStyle="single" borderColor={colors.dim} paddingX={1}>
            <Text color={colors.muted}>Select a provider to continue</Text>
          </Box>
        )}

        {!loading && providers.length === 0 && (
          <Box borderStyle="single" borderColor={colors.error} paddingX={1}>
            <Text color={colors.error}>Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY</Text>
          </Box>
        )}
      </Box>
    );
  }

  // Chat view
  return (
    <Box flexDirection="column" height="100%">
      <Box paddingX={1}>
        <Text color={colors.primary} bold>STUDIORA</Text>
        <Text color={colors.dim}> → </Text>
        <Text color={colors.accent}>{projectName}</Text>
        <Text color={colors.dim}> | </Text>
        <Text color={colors.success}>{state.provider}</Text>
      </Box>

      <Box flexGrow={1}>
        <Chat
          initialProvider={state.provider}
          directory={directory}
          onContextUpdate={(pct) => setState((s) => ({ ...s, contextPercentage: pct }))}
        />
      </Box>

      <Box
        borderStyle="single"
        borderTop={true}
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        borderColor={colors.dim}
        paddingX={1}
      >
        <Text color={colors.muted}>CTX </Text>
        <Text color={state.contextPercentage > 70 ? colors.warning : colors.accent}>
          {state.contextPercentage}%
        </Text>
        <Text color={colors.dim}> │ </Text>
        <Text color={colors.muted}>GIT </Text>
        {state.isRepo ? (
          <>
            <Text color={state.gitClean ? colors.success : colors.warning}>● </Text>
            <Text color={colors.primary}>{state.gitBranch}</Text>
          </>
        ) : (
          <Text color={colors.dim}>none</Text>
        )}
        <Text color={colors.dim}> │ </Text>
        <Text color={colors.muted}>/help</Text>
      </Box>
    </Box>
  );
}

async function main() {
  const options = parseCliArgs(process.argv);
  let directory = path.resolve(options.directory);

  // Load env from dev-wrapper directory first (for API keys)
  const devWrapperEnv = '/Users/mathewmoslow/dev-wrapper/.env.local';
  if (fs.existsSync(devWrapperEnv)) {
    const content = fs.readFileSync(devWrapperEnv, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const eqIndex = trimmed.indexOf('=');
        const key = trimmed.substring(0, eqIndex);
        const value = trimmed.substring(eqIndex + 1).replace(/^["']|["']$/g, '');
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }

  // Handle new project setup (runs BEFORE Ink)
  if (options.newProject) {
    const projectPath = await runSetupWizard(directory);
    if (!projectPath) {
      process.exit(1);
    }
    directory = projectPath;
    process.chdir(directory);
  } else {
    // Validate existing directory
    if (!fs.existsSync(directory)) {
      console.error(`Error: Directory does not exist: ${directory}`);
      console.error('Use --new to create a new project');
      process.exit(1);
    }
    process.chdir(directory);

    // Check if empty - offer setup
    const isEmpty = isEmptyDirectory(directory);
    const hasGit = fs.existsSync(path.join(directory, '.git'));
    if (isEmpty && !hasGit) {
      const doSetup = await confirm('Empty directory detected. Run project setup?', true);
      if (doSetup) {
        const projectPath = await runSetupWizard(directory);
        if (projectPath) {
          directory = projectPath;
          process.chdir(directory);
        }
      }
    }
  }

  // Load project-local env
  loadEnvFile();

  // Load API keys from shell profiles (fallback)
  loadShellEnv();

  // Load config
  await loadConfig();

  // Check providers
  const providers = getConfiguredProviders();
  if (providers.length === 0) {
    console.log('\n\x1b[33mWarning: No AI providers configured.\x1b[0m');
    console.log('Set: ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY\n');
  }

  // Start Ink app
  render(<App directory={directory} skipStartup={options.noStartup} />);
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
