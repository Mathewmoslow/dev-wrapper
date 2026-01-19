import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { StudioraConfig } from '../types/index.js';
import { colors, createHorizontalRule } from '../theme.js';
import { getGitStatus, getRecentCommits, isGitRepo, isHookInstalled } from '../modules/git/index.js';

interface StartupProps {
  config: StudioraConfig;
  directory: string;
  onContinue: () => void;
}

export function Startup({ config, directory }: StartupProps) {
  const [loading, setLoading] = useState(true);
  const [gitInfo, setGitInfo] = useState({
    isRepo: false,
    branch: 'unknown',
    isClean: true,
    fileCount: 0,
    commitCount: 0,
    hookInstalled: false,
  });

  useEffect(() => {
    async function loadGitInfo() {
      const repoCheck = await isGitRepo();
      if (repoCheck) {
        const [status, commits] = await Promise.all([
          getGitStatus(),
          getRecentCommits(config.startup.gitLogCount),
        ]);
        const hookCheck = isHookInstalled();
        setGitInfo({
          isRepo: true,
          branch: status.branch,
          isClean: status.isClean,
          fileCount: status.modified.length + status.staged.length + status.untracked.length,
          commitCount: commits.length,
          hookInstalled: hookCheck,
        });
      } else {
        setGitInfo({
          isRepo: false,
          branch: 'n/a',
          isClean: true,
          fileCount: 0,
          commitCount: 0,
          hookInstalled: false,
        });
      }
      setLoading(false);
    }
    loadGitInfo();
  }, [config.startup.gitLogCount]);

  const projectName = directory.split('/').pop() || directory;

  const gitStatusText = gitInfo.isRepo
    ? `${gitInfo.branch}${gitInfo.isClean ? ', clean' : `, ${gitInfo.fileCount} changed`}`
    : 'not a git repo';

  const gitStatusType: 'done' | 'warn' | 'pending' = loading
    ? 'pending'
    : !gitInfo.isRepo
    ? 'warn'
    : gitInfo.isClean
    ? 'done'
    : 'warn';

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
        status={gitStatusType}
        label="Git status"
        value={loading ? 'checking...' : gitStatusText}
      />
      <ChecklistRow
        status={loading ? 'pending' : gitInfo.commitCount > 0 ? 'done' : 'warn'}
        label="Recent commits"
        value={loading ? 'loading...' : `${gitInfo.commitCount} loaded`}
      />
      <ChecklistRow
        status={!gitInfo.isRepo ? 'warn' : gitInfo.hookInstalled ? 'done' : 'pending'}
        label="AI signature hook"
        value={!gitInfo.isRepo ? 'n/a' : gitInfo.hookInstalled ? 'installed' : 'installing...'}
      />
      <Text> </Text>
      <Box borderStyle="single" borderColor={colors.dim} paddingX={1}>
        <Text color={colors.secondary}>Press any key to start Claude session...</Text>
      </Box>
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
