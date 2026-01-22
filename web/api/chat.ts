// Vercel Serverless Function - keeps API keys server-side
import type { VercelRequest, VercelResponse } from '@vercel/node';

const PROVIDERS = {
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    getHeaders: (key: string) => ({
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    }),
    getBody: (messages: any[], systemPrompt?: string) => ({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: messages.filter((m: any) => m.role !== 'system').map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      ...(systemPrompt && { system: systemPrompt }),
    }),
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    getHeaders: (key: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    }),
    getBody: (messages: any[], systemPrompt?: string) => ({
      model: 'gpt-4o',
      max_tokens: 4096,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...messages.filter((m: any) => m.role !== 'system'),
      ],
    }),
  },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    getHeaders: () => ({
      'Content-Type': 'application/json',
    }),
    getBody: (messages: any[], systemPrompt?: string) => ({
      contents: messages.filter((m: any) => m.role !== 'system').map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      ...(systemPrompt && { systemInstruction: { parts: [{ text: systemPrompt }] } }),
      generationConfig: { maxOutputTokens: 4096 },
    }),
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { provider, messages, systemPrompt } = req.body;

  if (!provider || !messages) {
    return res.status(400).json({ error: 'Missing provider or messages' });
  }

  // Get API key from server-side env vars (NOT exposed to browser)
  const keyMap: Record<string, string | undefined> = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  };

  const apiKey = keyMap[provider];
  if (!apiKey) {
    return res.status(500).json({ error: `No API key configured for ${provider}` });
  }

  const config = PROVIDERS[provider as keyof typeof PROVIDERS];
  if (!config) {
    return res.status(400).json({ error: `Unknown provider: ${provider}` });
  }

  try {
    let url = config.url;
    if (provider === 'gemini') {
      url += `?key=${apiKey}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: config.getHeaders(apiKey),
      body: JSON.stringify(config.getBody(messages, systemPrompt)),
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error });
    }

    const data = await response.json();

    // Normalize response
    let content = '';
    if (provider === 'anthropic') {
      content = data.content?.[0]?.text || '';
    } else if (provider === 'openai') {
      content = data.choices?.[0]?.message?.content || '';
    } else if (provider === 'gemini') {
      content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    return res.status(200).json({ content });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
}
