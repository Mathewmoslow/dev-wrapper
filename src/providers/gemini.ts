import type {
  AIProvider,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  Message,
  ToolDefinition,
} from './types.js';

const DEFAULT_MODEL = 'gemini-1.5-pro';

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        functionCall?: { name: string; args: Record<string, unknown> };
      }>;
    };
    finishReason?: string;
  }>;
  usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
}

export class GeminiProvider implements AIProvider {
  name = 'gemini' as const;
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GEMINI_API_KEY_CONTEXT ||
      '';
    this.model = model || DEFAULT_MODEL;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  private get apiUrl(): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
  }

  private get streamApiUrl(): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?key=${this.apiKey}&alt=sse`;
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const response = await this.makeRequest(options, false);
    const data = await response.json() as GeminiResponse;
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
            if (!data) continue;

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

  private async makeRequest(options: CompletionOptions, stream: boolean): Promise<Response> {
    const { messages, systemPrompt, maxTokens = 4096, temperature = 0.7, tools } = options;

    const body: Record<string, unknown> = {
      contents: this.formatMessages(messages),
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    };

    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    if (tools && tools.length > 0) {
      body.tools = [{ functionDeclarations: this.formatTools(tools) }];
    }

    const url = stream ? this.streamApiUrl : this.apiUrl;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    return response;
  }

  private formatMessages(messages: Message[]): Array<{ role: string; parts: Array<{ text: string }> }> {
    return messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
  }

  private formatTools(tools: ToolDefinition[]): Array<Record<string, unknown>> {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  private parseResponse(data: GeminiResponse): CompletionResult {
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    let content = '';
    const toolCalls: CompletionResult['toolCalls'] = [];

    for (const part of parts) {
      if (part.text) {
        content += part.text;
      }
      if (part.functionCall) {
        toolCalls.push({
          id: `call_${Date.now()}`,
          name: part.functionCall.name,
          arguments: part.functionCall.args,
        });
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: data.usageMetadata
        ? {
            inputTokens: data.usageMetadata.promptTokenCount,
            outputTokens: data.usageMetadata.candidatesTokenCount,
          }
        : undefined,
      stopReason:
        candidate?.finishReason === 'STOP'
          ? 'end'
          : candidate?.finishReason === 'MAX_TOKENS'
          ? 'max_tokens'
          : 'end',
    };
  }

  private parseStreamEvent(event: {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
      finishReason?: string;
    }>;
  }): StreamChunk | null {
    const candidate = event.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;

    if (text) {
      return { type: 'text', text };
    }

    if (candidate?.finishReason === 'STOP') {
      return { type: 'done' };
    }

    return null;
  }
}
