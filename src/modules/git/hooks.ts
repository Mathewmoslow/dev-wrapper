import fs from 'fs';
import path from 'path';
import { simpleGit } from 'simple-git';

// Cross-platform hook using Node.js
const COMMIT_MSG_HOOK_NODE = `#!/usr/bin/env node
// studiora-dev: Removes AI co-author signatures from commit messages

const fs = require('fs');
const msgFile = process.argv[2];

if (!msgFile) process.exit(0);

let msg = fs.readFileSync(msgFile, 'utf-8');

// Patterns to remove
const patterns = [
  /^[\\s]*[Cc]o-[Aa]uthored-[Bb]y:.*([Cc]laude|[Cc]hat[Gg][Pp][Tt]|[Gg][Pp][Tt]|[Cc]opilot|[Aa]nthropic|[Oo]pen[Aa][Ii]|[Gg]emini|[Bb]ard|noreply@anthropic|noreply@openai).*\\n?/gm,
  /[Gg]enerated (by|with|using).*(Claude|ChatGPT|GPT|Copilot|AI|Gemini).*\\n?/gim,
  /🤖.*(Claude|AI|Generated).*\\n?/gm,
  /\\[.*AI.*[Gg]enerated.*\\].*\\n?/gm,
];

for (const p of patterns) {
  msg = msg.replace(p, '');
}

// Clean up extra blank lines
msg = msg.replace(/\\n{3,}/g, '\\n\\n').trim() + '\\n';

fs.writeFileSync(msgFile, msg);
`;

// Bash fallback for systems where node might not be in PATH for git hooks
const COMMIT_MSG_HOOK_BASH = `#!/bin/bash
# studiora-dev: Removes AI co-author signatures from commit messages

COMMIT_MSG_FILE=$1

# Try node first, fall back to sed
if command -v node &> /dev/null; then
  node -e "
const fs = require('fs');
const msgFile = process.argv[1];
if (!msgFile) process.exit(0);
let msg = fs.readFileSync(msgFile, 'utf-8');
const patterns = [
  /^[\\\\s]*[Cc]o-[Aa]uthored-[Bb]y:.*([Cc]laude|[Cc]hat[Gg][Pp][Tt]|[Gg][Pp][Tt]|[Cc]opilot|[Aa]nthropic|[Oo]pen[Aa][Ii]|[Gg]emini|[Bb]ard|noreply@anthropic|noreply@openai).*\\\\n?/gm,
  /[Gg]enerated (by|with|using).*(Claude|ChatGPT|GPT|Copilot|AI|Gemini).*\\\\n?/gim,
  /🤖.*(Claude|AI|Generated).*\\\\n?/gm,
  /\\\\[.*AI.*[Gg]enerated.*\\\\].*\\\\n?/gm,
];
for (const p of patterns) msg = msg.replace(p, '');
msg = msg.replace(/\\\\n{3,}/g, '\\\\n\\\\n').trim() + '\\\\n';
fs.writeFileSync(msgFile, msg);
" "$COMMIT_MSG_FILE"
else
  # Fallback to sed (works on Mac/Linux and Git Bash on Windows)
  sed -i.bak -E \\
    -e '/^[[:space:]]*[Cc]o-[Aa]uthored-[Bb]y:.*([Cc]laude|[Cc]hat[Gg][Pp][Tt]|[Gg][Pp][Tt]|[Cc]opilot|[Aa]nthropic|[Oo]pen[Aa][Ii]|[Gg]emini|[Bb]ard|noreply@anthropic|noreply@openai)/d' \\
    -e '/[Gg]enerated (by|with|using).*(Claude|ChatGPT|GPT|Copilot|AI|Gemini)/Id' \\
    "$COMMIT_MSG_FILE"
  rm -f "\${COMMIT_MSG_FILE}.bak"
fi
exit 0
`;

// Use Node hook on Windows, bash hook elsewhere (bash hook has node fallback too)
const isWindows = process.platform === 'win32';
const COMMIT_MSG_HOOK = isWindows ? COMMIT_MSG_HOOK_NODE : COMMIT_MSG_HOOK_BASH;

export async function installCommitMsgHook(cwd?: string): Promise<boolean> {
  const repoRoot = cwd || process.cwd();
  const git = simpleGit(repoRoot);

  try {
    // Check if this is a git repo
    await git.status();
  } catch {
    return false; // Not a git repo
  }

  const hooksDir = path.join(repoRoot, '.git', 'hooks');
  const hookPath = path.join(hooksDir, 'commit-msg');

  // Create hooks directory if it doesn't exist
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  // Check if hook already exists
  if (fs.existsSync(hookPath)) {
    const existingHook = fs.readFileSync(hookPath, 'utf-8');
    if (existingHook.includes('studiora-dev')) {
      return true; // Already installed
    }
    // Backup existing hook
    fs.writeFileSync(`${hookPath}.backup`, existingHook);
  }

  // Write new hook
  fs.writeFileSync(hookPath, COMMIT_MSG_HOOK, { mode: 0o755 });

  return true;
}

export async function uninstallCommitMsgHook(cwd?: string): Promise<boolean> {
  const repoRoot = cwd || process.cwd();
  const hookPath = path.join(repoRoot, '.git', 'hooks', 'commit-msg');
  const backupPath = `${hookPath}.backup`;

  if (!fs.existsSync(hookPath)) {
    return false;
  }

  const hook = fs.readFileSync(hookPath, 'utf-8');
  if (!hook.includes('studiora-dev')) {
    return false; // Not our hook
  }

  // Restore backup if exists
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, hookPath);
    fs.unlinkSync(backupPath);
  } else {
    fs.unlinkSync(hookPath);
  }

  return true;
}

export function isHookInstalled(cwd?: string): boolean {
  const repoRoot = cwd || process.cwd();
  const hookPath = path.join(repoRoot, '.git', 'hooks', 'commit-msg');

  if (!fs.existsSync(hookPath)) {
    return false;
  }

  const hook = fs.readFileSync(hookPath, 'utf-8');
  return hook.includes('studiora-dev');
}

// Strip AI signatures from a string (for use in auto-commit)
export function stripAISignatures(message: string): string {
  const patterns = [
    /^[\s]*[Cc]o-[Aa]uthored-[Bb]y:.*([Cc]laude|[Cc]hat[Gg][Pp][Tt]|[Gg][Pp][Tt]|[Cc]opilot|[Aa]nthropic|[Oo]pen[Aa][Ii]|[Gg]emini|[Bb]ard|noreply@anthropic|noreply@openai).*$/gm,
    /[Gg]enerated (by|with|using).*(Claude|ChatGPT|GPT|Copilot|AI|Gemini).*$/gim,
    /🤖.*(Claude|AI|Generated).*$/gm,
    /\[.*AI.*[Gg]enerated.*\].*$/gm,
  ];

  let result = message;
  for (const pattern of patterns) {
    result = result.replace(pattern, '');
  }

  // Clean up extra blank lines
  result = result.replace(/\n{3,}/g, '\n\n').trim();

  return result;
}
