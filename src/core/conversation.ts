import type { AIProvider, Message, CompletionResult, StreamChunk, ProviderName } from '../providers/types.js';
import { createProvider, generateHandoffSummary } from '../providers/index.js';

export interface ConversationOptions {
  provider: ProviderName;
  systemPrompt?: string;
  maxContextTokens?: number;
}

export interface ConversationState {
  provider: ProviderName;
  messages: Message[];
  totalTokens: number;
  systemPrompt: string;
}

export class Conversation {
  private provider: AIProvider;
  private messages: Message[] = [];
  private systemPrompt: string;
  private maxContextTokens: number;
  private totalInputTokens = 0;
  private totalOutputTokens = 0;

  constructor(options: ConversationOptions) {
    this.provider = createProvider(options.provider);
    this.systemPrompt = options.systemPrompt || this.getDefaultSystemPrompt();
    this.maxContextTokens = options.maxContextTokens || 100000;
  }

  get currentProvider(): ProviderName {
    return this.provider.name;
  }

  get messageHistory(): Message[] {
    return [...this.messages];
  }

  get tokenUsage(): { input: number; output: number; total: number } {
    return {
      input: this.totalInputTokens,
      output: this.totalOutputTokens,
      total: this.totalInputTokens + this.totalOutputTokens,
    };
  }

  get contextPercentage(): number {
    const estimatedTokens = this.estimateCurrentTokens();
    return Math.round((estimatedTokens / this.maxContextTokens) * 100);
  }

  // Send a message and get a response (non-streaming)
  async send(userMessage: string): Promise<CompletionResult> {
    this.messages.push({ role: 'user', content: userMessage });

    const result = await this.provider.complete({
      messages: this.messages,
      systemPrompt: this.systemPrompt,
    });

    this.messages.push({ role: 'assistant', content: result.content });

    if (result.usage) {
      this.totalInputTokens += result.usage.inputTokens;
      this.totalOutputTokens += result.usage.outputTokens;
    }

    return result;
  }

  // Send a message and stream the response
  async *sendStreaming(userMessage: string): AsyncIterable<StreamChunk> {
    this.messages.push({ role: 'user', content: userMessage });

    let fullResponse = '';

    for await (const chunk of this.provider.stream({
      messages: this.messages,
      systemPrompt: this.systemPrompt,
    })) {
      if (chunk.type === 'text' && chunk.text) {
        fullResponse += chunk.text;
      }
      yield chunk;
    }

    this.messages.push({ role: 'assistant', content: fullResponse });

    // Estimate tokens for streaming (no usage info available)
    this.totalInputTokens += this.provider.countTokens(userMessage);
    this.totalOutputTokens += this.provider.countTokens(fullResponse);
  }

  // Switch to a different provider with optional context handoff
  async switchProvider(newProvider: ProviderName, compact: boolean = true): Promise<string | null> {
    if (newProvider === this.provider.name) {
      return null;
    }

    let summary: string | null = null;

    if (compact && this.messages.length > 0) {
      // Generate summary of current conversation
      summary = await generateHandoffSummary(this.messages, this.provider);

      // Replace message history with summary
      this.messages = [
        {
          role: 'user',
          content: `[CONTEXT HANDOFF] Previous conversation summary:\n\n${summary}\n\nPlease continue from this context.`,
        },
        {
          role: 'assistant',
          content:
            "I understand. I've received the context from the previous conversation and I'm ready to continue helping you.",
        },
      ];
    }

    this.provider = createProvider(newProvider);
    return summary;
  }

  // Compact the conversation to save context
  async compact(): Promise<string> {
    if (this.messages.length < 4) {
      return 'Not enough messages to compact';
    }

    const summary = await generateHandoffSummary(this.messages, this.provider);

    this.messages = [
      {
        role: 'user',
        content: `[CONTEXT SUMMARY] Conversation summary:\n\n${summary}\n\nPlease continue from this context.`,
      },
      {
        role: 'assistant',
        content: "I understand. I've reviewed the context and I'm ready to continue.",
      },
    ];

    // Reset token counts (approximate)
    this.totalInputTokens = this.provider.countTokens(this.messages[0].content);
    this.totalOutputTokens = this.provider.countTokens(this.messages[1].content);

    return summary;
  }

  // Clear conversation history
  clear(): void {
    this.messages = [];
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
  }

  // Get current state for saving
  getState(): ConversationState {
    return {
      provider: this.provider.name,
      messages: [...this.messages],
      totalTokens: this.totalInputTokens + this.totalOutputTokens,
      systemPrompt: this.systemPrompt,
    };
  }

  // Restore from saved state
  loadState(state: ConversationState): void {
    this.provider = createProvider(state.provider);
    this.messages = [...state.messages];
    this.systemPrompt = state.systemPrompt;
  }

  private estimateCurrentTokens(): number {
    let tokens = this.provider.countTokens(this.systemPrompt);
    for (const msg of this.messages) {
      tokens += this.provider.countTokens(msg.content);
    }
    return tokens;
  }

  private getDefaultSystemPrompt(): string {
    return `You are a helpful AI assistant for software development. You help with:
- Writing and reviewing code
- Debugging issues
- Explaining concepts
- Planning implementations
- Answering technical questions

Be concise and practical. When showing code, use markdown code blocks with language tags.
Current working directory: ${process.cwd()}`;
  }
}
