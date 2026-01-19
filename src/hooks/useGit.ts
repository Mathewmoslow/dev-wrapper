import { useState, useEffect, useCallback } from 'react';
import type { GitStatus, GitCommit } from '../types/index.js';
import { getGitStatus, getRecentCommits, isGitRepo, autoCommit, installCommitMsgHook, isHookInstalled } from '../modules/git/index.js';

export interface UseGitOptions {
  pollInterval?: number; // ms, 0 to disable
  commitCount?: number;
  autoInstallHook?: boolean; // Auto-install AI signature stripper hook
}

export interface UseGitReturn {
  isRepo: boolean;
  status: GitStatus;
  commits: GitCommit[];
  loading: boolean;
  hookInstalled: boolean;
  refresh: () => Promise<void>;
  doAutoCommit: (prefix?: string) => Promise<string | null>;
}

const defaultStatus: GitStatus = {
  branch: 'unknown',
  isClean: true,
  modified: [],
  staged: [],
  untracked: [],
  ahead: 0,
  behind: 0,
};

export function useGit(options: UseGitOptions = {}): UseGitReturn {
  const { pollInterval = 5000, commitCount = 20, autoInstallHook = true } = options;

  const [isRepo, setIsRepo] = useState(false);
  const [status, setStatus] = useState<GitStatus>(defaultStatus);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [hookInstalled, setHookInstalled] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const repoCheck = await isGitRepo();
      setIsRepo(repoCheck);

      if (repoCheck) {
        const [newStatus, newCommits] = await Promise.all([
          getGitStatus(),
          getRecentCommits(commitCount),
        ]);
        setStatus(newStatus);
        setCommits(newCommits);

        // Check/install hook
        const hasHook = isHookInstalled();
        if (!hasHook && autoInstallHook) {
          await installCommitMsgHook();
          setHookInstalled(true);
        } else {
          setHookInstalled(hasHook);
        }
      }
    } catch (error) {
      console.error('Git refresh error:', error);
    } finally {
      setLoading(false);
    }
  }, [commitCount, autoInstallHook]);

  const doAutoCommit = useCallback(async (prefix?: string): Promise<string | null> => {
    const result = await autoCommit(prefix);
    await refresh(); // Refresh status after commit
    return result;
  }, [refresh]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Polling
  useEffect(() => {
    if (pollInterval <= 0) return;

    const interval = setInterval(refresh, pollInterval);
    return () => clearInterval(interval);
  }, [pollInterval, refresh]);

  return {
    isRepo,
    status,
    commits,
    loading,
    hookInstalled,
    refresh,
    doAutoCommit,
  };
}
