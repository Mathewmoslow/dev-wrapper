// AI Provider Types
export type ProviderName = 'anthropic' | 'openai' | 'gemini';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface CompletionOptions {
  messages: Message[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: ToolDefinition[];
}

export interface CompletionResult {
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  stopReason: 'end' | 'tool_use' | 'max_tokens';
}

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'done' | 'error';
  text?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  };
  error?: string;
}

export interface HealthCheckResult {
  status: 'green' | 'yellow' | 'red';
  message: string;
  hasApiKey: boolean;
  modelAvailable?: boolean;
  latencyMs?: number;
}

export interface AIProvider {
  name: ProviderName;
  complete(options: CompletionOptions): Promise<CompletionResult>;
  stream(options: CompletionOptions): AsyncIterable<StreamChunk>;
  countTokens(text: string): number;
  isConfigured(): boolean;
  checkHealth(): Promise<HealthCheckResult>;
}

// File System Types (Google Drive)
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  parents?: string[];
}

export interface DriveFolder extends DriveFile {
  mimeType: 'application/vnd.google-apps.folder';
}

// GitHub Types
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    date: string;
  };
}

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
  content?: string;
}

// App State Types
export interface AppSettings {
  anthropicKey: string;
  openaiKey: string;
  geminiKey: string;
  googleAccessToken: string;
  googleRefreshToken: string;
  githubToken: string;
  currentProvider: ProviderName;
  driveProjectFolderId: string;
  githubRepo: string;
}

export interface ConversationState {
  messages: Message[];
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
}

// Code Preview Types
export type PreviewMode = 'sandpack-react' | 'sandpack-vanilla' | 'pyodide' | 'none';

export interface ConsoleEntry {
  type: 'log' | 'error' | 'warn' | 'info';
  content: string;
  timestamp: number;
}

export interface PreviewState {
  mode: PreviewMode;
  files: Record<string, string>;
  entryFile: string;
  consoleOutput: ConsoleEntry[];
  error: string | null;
  isRunning: boolean;
}
