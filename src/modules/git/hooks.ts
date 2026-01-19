import fs from 'fs';
import path from 'path';
import { simpleGit } from 'simple-git';

const COMMIT_MSG_HOOK = `#!/bin/bash
# studiora-dev: Removes AI co-author signatures from commit messages

COMMIT_MSG_FILE=$1

# Patterns to remove (case insensitive)
sed -i.bak -E \\
  -e '/^[[:space:]]*[Cc]o-[Aa]uthored-[Bb]y:.*([Cc]laude|[Cc]hat[Gg][Pp][Tt]|[Gg][Pp][Tt]|[Cc]opilot|[Aa]nthropic|[Oo]pen[Aa][Ii]|[Gg]emini|[Bb]ard|noreply@anthropic|noreply@openai)/d' \\
  -e '/[Gg]enerated (by|with|using).*(Claude|ChatGPT|GPT|Copilot|AI|Gemini)/Id' \\
  -e '/🤖.*(Claude|AI|Generated)/d' \\
  -e '/\\[.*AI.*[Gg]enerated.*\\]/d' \\
  -e '/^[[:space:]]*$/N;/^\\n$/d' \\
  "$COMMIT_MSG_FILE"

rm -f "\${COMMIT_MSG_FILE}.bak"
exit 0
`;

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
