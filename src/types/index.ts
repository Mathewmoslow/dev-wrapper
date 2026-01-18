export interface StudioraConfig {
  git: GitConfig;
  context: ContextConfig;
  session: SessionConfig;
  startup: StartupConfig;
}

export interface GitConfig {
  autoCommitInterval: number;
  autoCommitEnabled: boolean;
  commitPrefix: string;
  pushAfterCommit: boolean;
}

export interface ContextConfig {
  warningThreshold: number;
  handoffThreshold: number;
  stopThreshold: number;
  estimateMethod: 'token-count' | 'message-count';
}

export interface SessionConfig {
  handoffDir: string;
  maxHandoffAge: number;
  autoLoadPreviousSession: boolean;
}

export interface StartupConfig {
  showGitLog: boolean;
  gitLogCount: number;
  loadCriticalFixes: boolean;
  runGitStatus: boolean;
}

export interface GitStatus {
  branch: string;
  isClean: boolean;
  modified: string[];
  staged: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}

export interface GitCommit {
  hash: string;
  message: string;
  date: Date;
  author: string;
}

export interface HandoffSession {
  id: string;
  filename: string;
  path: string;
  timestamp: Date;
  summary?: string;
}

export interface ContextState {
  percentage: number;
  tokensUsed: number;
  tokensTotal: number;
  messageCount: number;
  level: 'healthy' | 'warning' | 'critical' | 'stop';
}

export interface ChecklistItem {
  id: string;
  label: string;
  status: 'pending' | 'done' | 'warn' | 'fail' | 'ask';
  value?: string;
}

export type AppView = 'startup' | 'session';

export type ModalType = 'git' | 'context-warning' | 'commit' | 'handoff' | null;
