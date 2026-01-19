import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { StudioraConfig, AppView, ModalType, ContextState } from './types/index.js';
import { colors, createHorizontalRule } from './theme.js';
import { Terminal } from './components/Terminal.js';
import { useGit } from './hooks/useGit.js';

interface AppProps {
  config: StudioraConfig;
  skipStartup: boolean;
  directory: string;
}

export function App({ config, skipStartup, directory }: AppProps) {
  const { exit } = useApp();
  const [view, setView] = useState<AppView>(skipStartup ? 'session' : 'startup');
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Real git status
  const { isRepo, status: gitStatus, commits, loading: gitLoading, hookInstalled } = useGit({
    pollInterval: view === 'session' ? 5000 : 0, // Only poll during session
    commitCount: config.startup.gitLogCount,
  });

  const [contextState, setContextState] = useState<ContextState>({
    percentage: 0,
    tokensUsed: 0,
    tokensTotal: 200000,
    messageCount: 0,
    level: 'healthy',
  });

  // Handle startup view input
  useInput((input, key) => {
    if (view === 'startup') {
      if (input === 'y' || input === 'Y' || key.return) {
        // Load previous session and start
        setView('session');
      } else if (input === 'n' || input === 'N') {
        // Skip previous session and start fresh
        setView('session');
      } else if (key.escape || (key.ctrl && input === 'c')) {
        exit();
      }
    }
  }, { isActive: view === 'startup' });

  // Handle Claude exit
  const handleClaudeExit = (code: number) => {
    exit();
  };

  // Get project name from directory
  const projectName = directory.split('/').pop() || directory;

  // Format git status for display
  const fileCount = gitStatus.modified.length + gitStatus.staged.length + gitStatus.untracked.length;
  const gitStatusText = isRepo
    ? `${gitStatus.branch}${gitStatus.isClean ? ', clean' : `, ${fileCount} changed`}`
    : 'not a git repo';
  const gitStatusType: 'done' | 'warn' | 'fail' = !isRepo
    ? 'warn'
    : gitStatus.isClean
    ? 'done'
    : 'warn';

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
        <Text color={colors.dim}>{createHorizontalRule(68)}</Text>
        <Text> </Text>
        <ChecklistRow
          status={gitLoading ? 'pending' : gitStatusType}
          label="Git status"
          value={gitLoading ? 'checking...' : gitStatusText}
        />
        <ChecklistRow
          status={gitLoading ? 'pending' : commits.length > 0 ? 'done' : 'warn'}
          label="Recent commits"
          value={gitLoading ? 'loading...' : `${commits.length} loaded`}
        />
        <ChecklistRow
          status={!isRepo ? 'warn' : hookInstalled ? 'done' : 'pending'}
          label="AI signature hook"
          value={!isRepo ? 'n/a' : hookInstalled ? 'installed' : 'installing...'}
        />
        <ChecklistRow status="ask" label="Previous session" value="none found" />
        <Text> </Text>
        <Box borderStyle="single" borderColor={colors.dim} paddingX={1}>
          <Text color={colors.secondary}>Start Claude session? </Text>
          <Text color={colors.accent}>y</Text>
          <Text color={colors.secondary}>/n</Text>
        </Box>
      </Box>
    );
  }

  // Session view
  return (
    <Box flexDirection="column" height="100%">
      <Box flexGrow={1} flexDirection="column">
        <Terminal onExit={handleClaudeExit} />
      </Box>

      <StatusBar context={contextState} git={gitStatus} isRepo={isRepo} />
    </Box>
  );
}

interface ChecklistRowProps {
  status: 'done' | 'warn' | 'fail' | 'ask' | 'pending';
  label: string;
  value: string;
}

function ChecklistRow({ status, label, value }: ChecklistRowProps) {
  const tagColors: Record<string, string> = {
    done: colors.success,
    warn: colors.warning,
    fail: colors.error,
    ask: colors.accent,
    pending: colors.muted,
  };

  const tags: Record<string, string> = {
    done: '[done]',
    warn: '[warn]',
    fail: '[fail]',
    ask: '[ask]',
    pending: '[....]',
  };

  return (
    <Box>
      <Text color={tagColors[status]}>{tags[status]}</Text>
      <Text>  </Text>
      <Box width={20}>
        <Text color={colors.secondary}>{label}</Text>
      </Box>
      <Text color={status === 'ask' ? colors.accent : colors.primary}>{value}</Text>
    </Box>
  );
}

interface StatusBarProps {
  context: ContextState;
  git: {
    branch: string;
    isClean: boolean;
    modified: string[];
    staged: string[];
    untracked: string[];
  };
  isRepo: boolean;
}

function StatusBar({ context, git, isRepo }: StatusBarProps) {
  const contextColor =
    context.level === 'healthy' ? colors.accent :
    context.level === 'warning' ? colors.warning :
    colors.error;

  const filledCount = Math.round((context.percentage / 100) * 25);
  const progressFilled = '█'.repeat(filledCount);
  const progressEmpty = '░'.repeat(25 - filledCount);

  const fileCount = git.modified.length + git.staged.length + git.untracked.length;

  return (
    <Box
      borderStyle="single"
      borderTop={true}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderColor={colors.dim}
      paddingX={1}
    >
      <Text color={colors.secondary}>CONTEXT </Text>
      <Text color={contextColor}>{context.percentage}%</Text>
      <Text>  </Text>
      <Text color={contextColor}>{progressFilled}</Text>
      <Text color={colors.dim}>{progressEmpty}</Text>

      <Text color={colors.dim}>  │  </Text>

      <Text color={colors.secondary}>GIT </Text>
      {isRepo ? (
        <>
          <Text color={git.isClean ? colors.success : colors.warning}>● </Text>
          <Text color={colors.primary}>{git.branch}</Text>
          {!git.isClean && (
            <Text color={colors.warning}> {fileCount} files</Text>
          )}
        </>
      ) : (
        <Text color={colors.muted}>no repo</Text>
      )}

      <Text color={colors.dim}>  │  </Text>

      <Text color={colors.muted}>^G ^H ^Q</Text>
    </Box>
  );
}
