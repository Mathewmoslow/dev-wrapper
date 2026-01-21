import type {
  AIProvider,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  Message,
  ToolDefinition,
  HealthCheckResult,
} from './types.js';

const DEFAULT_MODEL = 'gpt-4o';
const API_URL = 'https://api.openai.com/v1/chat/completions';

interface OpenAIResponse {
  choices: Array<{
    message: {
      content?: string;
      tool_calls?: Array<{
        id: string;
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export class OpenAIProvider implements AIProvider {
  name = 'openai' as const;
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey ||
      process.env.OPENAI_API_KEY ||
      process.env.OPENAI_API_KEY_CONTEXT ||
      '';
    this.model = model || DEFAULT_MODEL;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const response = await this.makeRequest(options, false);
    const data = await response.json() as OpenAIResponse;
    return this.parseResponse(data);
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
            const data = line.slice(6).trim();
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
    // Rough approximation
    return Math.ceil(text.length / 4);
  }

  async checkHealth(): Promise<HealthCheckResult> {
    if (!this.apiKey) {
      return {
        status: 'red',
        message: 'No API key configured',
        hasApiKey: false,
      };
    }

    if (this.apiKey.length < 20) {
      return {
        status: 'yellow',
        message: 'API key appears invalid (too short)',
        hasApiKey: true,
      };
    }

    try {
      const start = Date.now();
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });
      const latencyMs = Date.now() - start;

      if (response.ok) {
        return {
          status: 'green',
          message: `Connected (${latencyMs}ms)`,
          hasApiKey: true,
          modelAvailable: true,
          latencyMs,
        };
      } else if (response.status === 401) {
        return {
          status: 'red',
          message: 'Invalid API key',
          hasApiKey: true,
          modelAvailable: false,
        };
      } else if (response.status === 429) {
        return {
          status: 'yellow',
          message: 'Rate limited',
          hasApiKey: true,
          modelAvailable: true,
        };
      } else {
        return {
          status: 'yellow',
          message: `API error: ${response.status}`,
          hasApiKey: true,
        };
      }
    } catch (err) {
      return {
        status: 'red',
        message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown'}`,
        hasApiKey: true,
      };
    }
  }

  private async makeRequest(options: CompletionOptions, stream: boolean): Promise<Response> {
    const { messages, systemPrompt, maxTokens = 4096, temperature = 0.7, tools } = options;

    const formattedMessages = this.formatMessages(messages, systemPrompt);

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: maxTokens,
      temperature,
      messages: formattedMessages,
      stream,
    };

    if (tools && tools.length > 0) {
      body.tools = this.formatTools(tools);
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    return response;
  }

  private formatMessages(
    messages: Message[],
    systemPrompt?: string
  ): Array<{ role: string; content: string }> {
    const result: Array<{ role: string; content: string }> = [];

    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt });
    }

    for (const m of messages) {
      if (m.role === 'system' && !systemPrompt) {
        result.push({ role: 'system', content: m.content });
      } else if (m.role !== 'system') {
        result.push({ role: m.role, content: m.content });
      }
    }

    return result;
  }

  private formatTools(tools: ToolDefinition[]): Array<Record<string, unknown>> {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  private parseResponse(data: OpenAIResponse): CompletionResult {
    const choice = data.choices[0];
    const message = choice?.message;

    const toolCalls = message?.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments || '{}'),
    }));

    return {
      content: message?.content || '',
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      usage: data.usage
        ? {
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens,
          }
        : undefined,
      stopReason:
        choice?.finish_reason === 'tool_calls'
          ? 'tool_use'
          : choice?.finish_reason === 'length'
          ? 'max_tokens'
          : 'end',
    };
  }

  private parseStreamEvent(event: {
    choices?: Array<{
      delta?: {
        content?: string;
        tool_calls?: Array<{
          index: number;
          id?: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
      finish_reason?: string;
    }>;
  }): StreamChunk | null {
    const choice = event.choices?.[0];
    const delta = choice?.delta;

    if (delta?.content) {
      return { type: 'text', text: delta.content };
    }

    if (delta?.tool_calls?.[0]) {
      const tc = delta.tool_calls[0];
      if (tc.id && tc.function?.name) {
        return {
          type: 'tool_call',
          toolCall: {
            id: tc.id,
            name: tc.function.name,
            arguments: {},
          },
        };
      }
    }

    if (choice?.finish_reason === 'stop') {
      return { type: 'done' };
    }

    return null;
  }
}
