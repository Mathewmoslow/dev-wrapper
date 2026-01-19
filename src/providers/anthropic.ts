import type {
  AIProvider,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  Message,
  ToolDefinition,
} from './types.js';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const API_URL = 'https://api.anthropic.com/v1/messages';

export class AnthropicProvider implements AIProvider {
  name = 'anthropic' as const;
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.CLAUDE_API_KEY ||
      process.env.ANTHROPIC_API_KEY_CONTEXT ||
      '';
    this.model = model || DEFAULT_MODEL;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const response = await this.makeRequest(options, false);
    return this.parseResponse(response);
  }

  async *stream(options: CompletionOptions): AsyncIterable<StreamChunk> {
    const response = await this.makeRequest(options, true);

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              yield { type: 'done' };
              return;
            }

            try {
              const event = JSON.parse(data);
              const chunk = this.parseStreamEvent(event);
              if (chunk) yield chunk;
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      yield { type: 'done' };
    } finally {
      reader.releaseLock();
    }
  }

  countTokens(text: string): number {
    // Rough approximation: ~4 chars per token for English
    return Math.ceil(text.length / 4);
  }

  private async makeRequest(options: CompletionOptions, stream: boolean): Promise<Response> {
    const { messages, systemPrompt, maxTokens = 4096, temperature = 0.7, tools } = options;

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: maxTokens,
      temperature,
      messages: this.formatMessages(messages),
      stream,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    if (tools && tools.length > 0) {
      body.tools = this.formatTools(tools);
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    return response;
  }

  private formatMessages(messages: Message[]): Array<{ role: string; content: string }> {
    return messages
      .filter((m) => m.role !== 'system') // System is handled separately
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));
  }

  private formatTools(tools: ToolDefinition[]): Array<Record<string, unknown>> {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  }

  private async parseResponse(response: Response): Promise<CompletionResult> {
    const data = await response.json() as {
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
      usage?: { input_tokens: number; output_tokens: number };
      stop_reason?: string;
    };

    let content = '';
    const toolCalls: CompletionResult['toolCalls'] = [];

    for (const block of data.content) {
      if (block.type === 'text' && block.text) {
        content += block.text;
      } else if (block.type === 'tool_use' && block.id && block.name) {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input || {},
        });
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: data.usage
        ? {
            inputTokens: data.usage.input_tokens,
            outputTokens: data.usage.output_tokens,
          }
        : undefined,
      stopReason:
        data.stop_reason === 'tool_use'
          ? 'tool_use'
          : data.stop_reason === 'max_tokens'
          ? 'max_tokens'
          : 'end',
    };
  }

  private parseStreamEvent(event: {
    type: string;
    delta?: { type: string; text?: string };
    content_block?: { type: string; id?: string; name?: string };
  }): StreamChunk | null {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      return { type: 'text', text: event.delta.text };
    }

    if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
      return {
        type: 'tool_call',
        toolCall: {
          id: event.content_block.id || '',
          name: event.content_block.name || '',
          arguments: {},
        },
      };
    }

    if (event.type === 'message_stop') {
      return { type: 'done' };
    }

    if (event.type === 'error') {
      return { type: 'error', error: JSON.stringify(event) };
    }

    return null;
  }
}
