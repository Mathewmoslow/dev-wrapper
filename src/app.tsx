import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { StudioraConfig, AppView, ModalType, ContextState, GitStatus } from './types/index.js';
import { colors, createHorizontalRule } from './theme.js';

interface AppProps {
  config: StudioraConfig;
  skipStartup: boolean;
}

export function App({ config, skipStartup }: AppProps) {
  const [view, setView] = useState<AppView>(skipStartup ? 'session' : 'startup');
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const [contextState, setContextState] = useState<ContextState>({
    percentage: 0,
    tokensUsed: 0,
    tokensTotal: 200000,
    messageCount: 0,
    level: 'healthy',
  });

  const [gitStatus, setGitStatus] = useState<GitStatus>({
    branch: 'main',
    isClean: true,
    modified: [],
    staged: [],
    untracked: [],
    ahead: 0,
    behind: 0,
  });

  // Startup view
  if (view === 'startup') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color={colors.primary} bold>STUDIORA DEV</Text>
        <Text> </Text>
        <Text color={colors.muted}>Preflight</Text>
        <Text color={colors.dim}>{createHorizontalRule(68)}</Text>
        <Text> </Text>
        <ChecklistRow status="done" label="Git status" value="main, clean" />
        <ChecklistRow status="done" label="Recent commits" value="20 loaded" />
        <ChecklistRow status="done" label="Critical fixes" value="12 items documented" />
        <ChecklistRow status="ask" label="Previous session" value="session-2026-01-14-1823.md" />
        <Text> </Text>
        <Box borderStyle="single" borderColor={colors.dim} paddingX={1}>
          <Text color={colors.secondary}>Load previous session context? </Text>
          <Text color={colors.accent}>y</Text>
          <Text color={colors.secondary}>/n</Text>
        </Box>
      </Box>
    );
  }

  // Session view
  return (
    <Box flexDirection="column" height="100%">
      <Box flexGrow={1} flexDirection="column" paddingX={2} paddingY={1}>
        <Text color={colors.muted}>Session started at 14:23:07</Text>
        <Text> </Text>
        <Text color={colors.accent}>claude{'>'} </Text>
        <Text color={colors.primary}>What would you like to work on?</Text>
      </Box>

      <StatusBar context={contextState} git={gitStatus} />
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
  git: GitStatus;
}

function StatusBar({ context, git }: StatusBarProps) {
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
      <Text color={git.isClean ? colors.success : colors.warning}>● </Text>
      <Text color={colors.primary}>{git.branch}</Text>
      {!git.isClean && (
        <Text color={colors.warning}> {fileCount} files</Text>
      )}

      <Text color={colors.dim}>  │  </Text>

      <Text color={colors.muted}>^G ^H ^Q</Text>
    </Box>
  );
}
