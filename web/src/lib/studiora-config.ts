// .studiora/ configuration types and service

export interface ProjectStack {
  framework: 'react' | 'next' | 'vue' | 'svelte' | 'express' | 'fastapi' | 'none';
  language: 'typescript' | 'javascript' | 'python';
  styling?: 'mui' | 'tailwind' | 'css' | 'scss' | 'none';
  database?: 'postgres' | 'mysql' | 'mongodb' | 'supabase' | 'firebase' | 'none';
  deployment?: 'vercel' | 'netlify' | 'aws' | 'gcp' | 'docker' | 'none';
}

export interface SecurityConfig {
  envVars: string[];  // List of env var names that should be kept secret
  secretsPattern: string[];  // Glob patterns for files that shouldn't be committed
  httpsEnforced: boolean;
  corsOrigins?: string[];
}

export interface ProjectConfig {
  name: string;
  description: string;  // Original user intent - "What do you want to build?"
  created: string;
  updated: string;
  stack: ProjectStack;
  security: SecurityConfig;
  aiContext: string;  // Persistent context for AI about this project
  customPrompt?: string;  // Additional system prompt for this project
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tokenCount?: number;
}

export interface ConversationState {
  id: string;
  name: string;
  created: string;
  updated: string;
  provider: 'anthropic' | 'openai' | 'gemini';
  messages: ConversationMessage[];
  totalTokens: number;
  maxTokens: number;
}

export interface SessionSummary {
  id: string;
  date: string;
  title: string;
  summary: string;
  keyDecisions: string[];
  filesModified: string[];
  tokensUsed: number;
}

// Token estimation (rough approximation - 1 token ≈ 4 chars for English)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Context limits by provider
export const CONTEXT_LIMITS: Record<string, number> = {
  anthropic: 200000,  // Claude 3
  openai: 128000,     // GPT-4 Turbo
  gemini: 1000000,    // Gemini 1.5
};

// When to trigger auto-compaction (percentage of context used)
export const COMPACTION_THRESHOLD = 0.75;

// Default project config template
export function createDefaultConfig(name: string, description: string): ProjectConfig {
  return {
    name,
    description,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    stack: {
      framework: 'none',
      language: 'typescript',
    },
    security: {
      envVars: [],
      secretsPattern: ['*.env*', '.env.*', 'secrets.*'],
      httpsEnforced: true,
    },
    aiContext: description,
  };
}

// File paths within .studiora/
export const STUDIORA_PATHS = {
  root: '.studiora',
  config: '.studiora/project.json',
  prompts: '.studiora/prompts.md',
  summaries: '.studiora/summaries',
  conversations: '.studiora/conversations',
  currentConversation: '.studiora/conversations/current.json',
};

// Generate summary prompt for compaction
export function generateCompactionPrompt(messages: ConversationMessage[]): string {
  const conversation = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  return `Please summarize the following conversation into a concise summary that captures:
1. What was discussed/built
2. Key decisions made
3. Files that were created or modified
4. Any unresolved issues or next steps

Keep the summary under 500 words but ensure all critical context is preserved so work can continue later.

CONVERSATION:
${conversation}

Provide your response in this format:
## Summary
[Brief overview]

## Key Decisions
- [Decision 1]
- [Decision 2]

## Files Modified
- [file1.ts]
- [file2.ts]

## Next Steps
- [What to do next]`;
}

// Default system prompt template
export function generateSystemPrompt(config: ProjectConfig, summary?: SessionSummary): string {
  let prompt = `You are an AI coding assistant helping with the project "${config.name}".

PROJECT DESCRIPTION:
${config.description}

TECH STACK:
- Framework: ${config.stack.framework}
- Language: ${config.stack.language}
${config.stack.styling ? `- Styling: ${config.stack.styling}` : ''}
${config.stack.database ? `- Database: ${config.stack.database}` : ''}
${config.stack.deployment ? `- Deployment: ${config.stack.deployment}` : ''}

SECURITY REQUIREMENTS:
- Environment variables that must stay secret: ${config.security.envVars.join(', ') || 'none specified'}
- Always use HTTPS in production
- Never expose API keys in client-side code
`;

  if (config.customPrompt) {
    prompt += `\nADDITIONAL INSTRUCTIONS:\n${config.customPrompt}\n`;
  }

  if (summary) {
    prompt += `\nPREVIOUS SESSION CONTEXT:
${summary.summary}

Key decisions from last session:
${summary.keyDecisions.map(d => `- ${d}`).join('\n')}

Files previously modified:
${summary.filesModified.map(f => `- ${f}`).join('\n')}
`;
  }

  return prompt;
}
