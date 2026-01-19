export * from './types.js';
export { AnthropicProvider } from './anthropic.js';
export { OpenAIProvider } from './openai.js';
export { GeminiProvider } from './gemini.js';

import type { AIProvider, ProviderName, Message } from './types.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { GeminiProvider } from './gemini.js';

// Provider factory
export function createProvider(name: ProviderName): AIProvider {
  switch (name) {
    case 'anthropic':
      return new AnthropicProvider();
    case 'openai':
      return new OpenAIProvider();
    case 'gemini':
      return new GeminiProvider();
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

// Get all configured providers
export function getConfiguredProviders(): AIProvider[] {
  const providers: AIProvider[] = [
    new AnthropicProvider(),
    new OpenAIProvider(),
    new GeminiProvider(),
  ];

  return providers.filter((p) => p.isConfigured());
}

// Generate a summary of conversation for handoff
export async function generateHandoffSummary(
  messages: Message[],
  provider: AIProvider
): Promise<string> {
  const conversationText = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const result = await provider.complete({
    messages: [
      {
        role: 'user',
        content: `Summarize this conversation concisely, capturing key context, decisions made, and current task state. Keep it under 500 words.

CONVERSATION:
${conversationText}`,
      },
    ],
    systemPrompt:
      'You are a helpful assistant that creates concise conversation summaries for handoff to another AI. Focus on preserving context and task state.',
    maxTokens: 1000,
    temperature: 0.3,
  });

  return result.content;
}
