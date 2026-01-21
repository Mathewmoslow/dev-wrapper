import type { AIProvider, ProviderName } from '../lib/types';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';

export { AnthropicProvider } from './anthropic';
export { OpenAIProvider } from './openai';
export { GeminiProvider } from './gemini';

export function createProvider(name: ProviderName, apiKey: string): AIProvider {
  switch (name) {
    case 'anthropic':
      return new AnthropicProvider(apiKey);
    case 'openai':
      return new OpenAIProvider(apiKey);
    case 'gemini':
      return new GeminiProvider(apiKey);
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

export function getProviderDisplayName(name: ProviderName): string {
  switch (name) {
    case 'anthropic':
      return 'Claude (Anthropic)';
    case 'openai':
      return 'GPT (OpenAI)';
    case 'gemini':
      return 'Gemini (Google)';
    default:
      return name;
  }
}
