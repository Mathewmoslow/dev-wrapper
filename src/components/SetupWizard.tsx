import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { colors } from '../theme.js';
import {
  setupProject,
  runVercelLink,
  isVercelInstalled,
} from '../modules/setup/project.js';

type SetupStep = 'project-name' | 'github-user' | 'create-dir' | 'running' | 'vercel' | 'complete';

interface SetupWizardProps {
  baseDirectory: string;
  onComplete: (projectPath: string) => void;
  onCancel: () => void;
}

export function SetupWizard({ baseDirectory, onComplete, onCancel }: SetupWizardProps) {
  const { exit } = useApp();

  const [step, setStep] = useState<SetupStep>('project-name');
  const [projectName, setProjectName] = useState('');
  const [githubUser, setGithubUser] = useState('');
  const [createDir, setCreateDir] = useState(true);
  const [status, setStatus] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [projectPath, setProjectPath] = useState('');
  const [hasVercel, setHasVercel] = useState(false);

  // Check if Vercel is installed
  useEffect(() => {
    setHasVercel(isVercelInstalled());
  }, []);

  // Handle keyboard for cancel
  useInput((input, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  const runSetup = async () => {
    setStep('running');
    setStatus(['Setting up project...']);

    try {
      // Git + GitHub setup
      setStatus((s) => [...s, '→ Initializing git...']);
      const result = await setupProject({
        projectName,
        githubUsername: githubUser,
        createDirectory: createDir,
        baseDirectory,
      });

      if (result.gitInitialized) {
        setStatus((s) => [...s, '✓ Git initialized']);
      }
      if (result.remoteAdded) {
        setStatus((s) => [...s, `✓ GitHub remote added: github.com/${githubUser}/${projectName}`]);
      }

      if (result.errors.length > 0) {
        setError(result.errors.join('\n'));
      }

      setProjectPath(result.projectPath);

      // Move to Vercel step if available
      if (hasVercel) {
        setStep('vercel');
      } else {
        setStatus((s) => [...s, '⚠ Vercel CLI not found, skipping...']);
        setStep('complete');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    }
  };

  const runVercel = () => {
    // Clear the screen for vercel's interactive prompts
    process.stdout.write('\x1b[2J\x1b[H');
    console.log('\n📦 Vercel Project Setup\n');
    console.log('Follow the prompts below to link your project to Vercel.\n');

    // This is synchronous and blocks until vercel link completes
    const success = runVercelLink(projectPath);

    // Clear screen and show result
    process.stdout.write('\x1b[2J\x1b[H');

    if (success) {
      setStatus((s) => [...s, '✓ Vercel project linked']);
    } else {
      setStatus((s) => [...s, '⚠ Vercel link skipped or failed']);
    }

    setStep('complete');
  };

  // Project name input
  if (step === 'project-name') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.primary} bold>📦 NEW PROJECT SETUP</Text>
        <Text color={colors.dim}>─────────────────────────────────────</Text>
        <Text> </Text>
        <Text color={colors.muted}>Press ESC to cancel</Text>
        <Text> </Text>
        <Box>
          <Text color={colors.secondary}>Project name: </Text>
          <TextInput
            value={projectName}
            onChange={setProjectName}
            onSubmit={() => {
              if (projectName.trim()) {
                setStep('github-user');
              }
            }}
            placeholder="my-awesome-project"
          />
        </Box>
      </Box>
    );
  }

  // GitHub username input
  if (step === 'github-user') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.primary} bold>📦 NEW PROJECT SETUP</Text>
        <Text color={colors.dim}>─────────────────────────────────────</Text>
        <Text> </Text>
        <Text color={colors.success}>✓ Project: {projectName}</Text>
        <Text> </Text>
        <Box>
          <Text color={colors.secondary}>GitHub username: </Text>
          <TextInput
            value={githubUser}
            onChange={setGithubUser}
            onSubmit={() => {
              if (githubUser.trim()) {
                setStep('create-dir');
              }
            }}
            placeholder="your-username"
          />
        </Box>
      </Box>
    );
  }

  // Create directory confirmation
  if (step === 'create-dir') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.primary} bold>📦 NEW PROJECT SETUP</Text>
        <Text color={colors.dim}>─────────────────────────────────────</Text>
        <Text> </Text>
        <Text color={colors.success}>✓ Project: {projectName}</Text>
        <Text color={colors.success}>✓ GitHub: github.com/{githubUser}/{projectName}</Text>
        <Text> </Text>
        <Text color={colors.secondary}>Create new directory './{projectName}'?</Text>
        <Text> </Text>
        <Box>
          <Text color={createDir ? colors.accent : colors.dim}>
            {createDir ? '▸ ' : '  '}[Y] Yes, create directory
          </Text>
        </Box>
        <Box>
          <Text color={!createDir ? colors.accent : colors.dim}>
            {!createDir ? '▸ ' : '  '}[N] No, use current directory
          </Text>
        </Box>
        <Text> </Text>
        <Text color={colors.muted}>Press Y/N or Enter to continue</Text>
        <CreateDirInput
          value={createDir}
          onChange={setCreateDir}
          onSubmit={runSetup}
        />
      </Box>
    );
  }

  // Running setup
  if (step === 'running') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.primary} bold>📦 NEW PROJECT SETUP</Text>
        <Text color={colors.dim}>─────────────────────────────────────</Text>
        <Text> </Text>
        {status.map((s, i) => (
          <Text key={i} color={s.startsWith('✓') ? colors.success : s.startsWith('⚠') ? colors.warning : colors.secondary}>
            {s}
          </Text>
        ))}
        {error && <Text color={colors.error}>{error}</Text>}
      </Box>
    );
  }

  // Vercel prompt
  if (step === 'vercel') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.primary} bold>📦 NEW PROJECT SETUP</Text>
        <Text color={colors.dim}>─────────────────────────────────────</Text>
        <Text> </Text>
        {status.map((s, i) => (
          <Text key={i} color={s.startsWith('✓') ? colors.success : s.startsWith('⚠') ? colors.warning : colors.secondary}>
            {s}
          </Text>
        ))}
        <Text> </Text>
        <Text color={colors.secondary}>Link to Vercel?</Text>
        <Text color={colors.muted}>(This will open an interactive Vercel setup)</Text>
        <Text> </Text>
        <Box>
          <Text color={colors.accent}>[Y] Yes</Text>
          <Text color={colors.dim}>  </Text>
          <Text color={colors.dim}>[N] Skip</Text>
        </Box>
        <VercelPrompt
          onYes={runVercel}
          onNo={() => setStep('complete')}
        />
      </Box>
    );
  }

  // Complete
  if (step === 'complete') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.success} bold>✅ PROJECT SETUP COMPLETE</Text>
        <Text color={colors.dim}>─────────────────────────────────────</Text>
        <Text> </Text>
        {status.map((s, i) => (
          <Text key={i} color={s.startsWith('✓') ? colors.success : s.startsWith('⚠') ? colors.warning : colors.secondary}>
            {s}
          </Text>
        ))}
        <Text> </Text>
        <Text color={colors.muted}>Next steps:</Text>
        <Text color={colors.secondary}>  1. Create the repo on GitHub: https://github.com/new</Text>
        <Text color={colors.secondary}>  2. Start coding with AI assistance</Text>
        <Text> </Text>
        <Text color={colors.accent}>Press Enter to start AI session...</Text>
        <CompletePrompt onContinue={() => onComplete(projectPath)} />
      </Box>
    );
  }

  return null;
}

// Helper components for input handling
function CreateDirInput({
  value,
  onChange,
  onSubmit,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  onSubmit: () => void;
}) {
  useInput((input, key) => {
    if (input === 'y' || input === 'Y') {
      onChange(true);
      onSubmit();
    } else if (input === 'n' || input === 'N') {
      onChange(false);
      onSubmit();
    } else if (key.return) {
      onSubmit();
    }
  });
  return null;
}

function VercelPrompt({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  const [ready, setReady] = useState(false);

  // Delay to prevent Enter key from previous step bleeding through
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useInput((input) => {
    if (!ready) return;
    if (input === 'y' || input === 'Y') {
      onYes();
    } else if (input === 'n' || input === 'N') {
      onNo();
    }
  });
  return null;
}

function CompletePrompt({ onContinue }: { onContinue: () => void }) {
  const [ready, setReady] = useState(false);

  // Delay to prevent Enter key from previous step bleeding through
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useInput((input, key) => {
    if (!ready) return;
    if (key.return) {
      onContinue();
    }
  });
  return null;
}
