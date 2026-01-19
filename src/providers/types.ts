// Unified types for all AI providers

export type ProviderName = 'anthropic' | 'openai' | 'gemini';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  content: string;
  isError?: boolean;
}

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'done' | 'error';
  text?: string;
  toolCall?: ToolCall;
  error?: string;
}

export interface CompletionOptions {
  messages: Message[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: ToolDefinition[];
  stream?: boolean;
}

export interface CompletionResult {
  content: string;
  toolCalls?: ToolCall[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  stopReason?: 'end' | 'tool_use' | 'max_tokens';
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface AIProvider {
  name: ProviderName;

  // Non-streaming completion
  complete(options: CompletionOptions): Promise<CompletionResult>;

  // Streaming completion
  stream(options: CompletionOptions): AsyncIterable<StreamChunk>;

  // Count tokens (approximate)
  countTokens(text: string): number;

  // Check if provider is configured
  isConfigured(): boolean;
}

// Provider configuration
export interface ProviderConfig {
  anthropic?: {
    apiKey: string;
    model?: string;
  };
  openai?: {
    apiKey: string;
    model?: string;
  };
  gemini?: {
    apiKey: string;
    model?: string;
  };
}
