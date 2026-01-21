import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp, useStdin } from 'ink';
import TextInput from 'ink-text-input';
import { Conversation } from '../core/conversation.js';
import type { ProviderName, HealthCheckResult } from '../providers/types.js';
import { colors } from '../theme.js';
import { getConfiguredProviders, createProvider } from '../providers/index.js';

interface ChatProps {
  initialProvider: ProviderName;
  directory: string;
  onContextUpdate?: (percentage: number) => void;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider?: ProviderName;
}

export function Chat({ initialProvider, directory, onContextUpdate }: ChatProps) {
  const { exit } = useApp();
  const { setRawMode } = useStdin();

  const [conversation] = useState(() => new Conversation({ provider: initialProvider }));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Enable raw mode for input
  useEffect(() => {
    setRawMode(true);
    return () => setRawMode(false);
  }, [setRawMode]);

  // Handle special commands
  const handleCommand = useCallback(
    async (cmd: string): Promise<boolean> => {
      const parts = cmd.trim().split(' ');
      const command = parts[0].toLowerCase();

      switch (command) {
        case '/help':
          setShowHelp(!showHelp);
          return true;

        case '/clear':
          conversation.clear();
          setMessages([]);
          setMessages([{ role: 'system', content: 'Conversation cleared.' }]);
          return true;

        case '/switch': {
          const provider = parts[1] as ProviderName;
          if (!['anthropic', 'openai', 'gemini'].includes(provider)) {
            setMessages((m) => [
              ...m,
              { role: 'system', content: 'Usage: /switch <anthropic|openai|gemini>' },
            ]);
            return true;
          }

          setMessages((m) => [...m, { role: 'system', content: `Switching to ${provider}...` }]);
          const summary = await conversation.switchProvider(provider, true);
          setMessages((m) => [
            ...m,
            {
              role: 'system',
              content: `Switched to ${provider}${summary ? '. Context compacted.' : '.'}`,
            },
          ]);
          return true;
        }

        case '/compact':
          setMessages((m) => [...m, { role: 'system', content: 'Compacting conversation...' }]);
          await conversation.compact();
          setMessages((m) => [...m, { role: 'system', content: 'Conversation compacted.' }]);
          onContextUpdate?.(conversation.contextPercentage);
          return true;

        case '/providers': {
          const configured = getConfiguredProviders();
          const list = configured.map((p) => `  - ${p.name}${p.name === conversation.currentProvider ? ' (active)' : ''}`).join('\n');
          setMessages((m) => [
            ...m,
            { role: 'system', content: `Available providers:\n${list}` },
          ]);
          return true;
        }

        case '/status': {
          setMessages((m) => [...m, { role: 'system', content: 'Checking provider health...' }]);

          const providers = ['anthropic', 'openai', 'gemini'] as const;
          const results: string[] = [];

          for (const name of providers) {
            try {
              const provider = createProvider(name);
              const health = await provider.checkHealth();
              const icon = health.status === 'green' ? '🟢' : health.status === 'yellow' ? '🟡' : '🔴';
              const active = name === conversation.currentProvider ? ' (active)' : '';
              results.push(`  ${icon} ${name}${active}: ${health.message}`);
            } catch {
              results.push(`  🔴 ${name}: Error checking health`);
            }
          }

          setMessages((m) => [
            ...m,
            { role: 'system', content: `Provider Status:\n${results.join('\n')}` },
          ]);
          return true;
        }

        case '/model': {
          setMessages((m) => [
            ...m,
            { role: 'system', content: `Current provider: ${conversation.currentProvider}\nUse /switch <provider> to change` },
          ]);
          return true;
        }

        case '/tokens': {
          const usage = conversation.tokenUsage;
          const pct = conversation.contextPercentage;
          setMessages((m) => [
            ...m,
            { role: 'system', content: `Token Usage:\n  Input: ${usage.input}\n  Output: ${usage.output}\n  Total: ${usage.total}\n  Context: ${pct}%` },
          ]);
          return true;
        }

        case '/save': {
          const state = conversation.getState();
          const filename = `conversation-${Date.now()}.json`;
          // Note: Would need fs access to actually save
          setMessages((m) => [
            ...m,
            { role: 'system', content: `Conversation state ready to save (${state.messages.length} messages)` },
          ]);
          return true;
        }

        case '/exit':
        case '/quit':
          exit();
          return true;

        default:
          if (cmd.startsWith('/')) {
            setMessages((m) => [
              ...m,
              { role: 'system', content: `Unknown command: ${cmd.split(' ')[0]}\nType /help for available commands` },
            ]);
            return true;
          }
          return false;
      }
    },
    [conversation, exit, onContextUpdate, showHelp]
  );

  // Send message
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput('');
    setError(null);

    // Check for commands
    if (text.startsWith('/')) {
      const handled = await handleCommand(text);
      if (handled) return;
    }

    // Add user message
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setIsStreaming(true);
    setStreamingText('');

    try {
      let fullResponse = '';

      for await (const chunk of conversation.sendStreaming(text)) {
        if (chunk.type === 'text' && chunk.text) {
          fullResponse += chunk.text;
          setStreamingText(fullResponse);
        } else if (chunk.type === 'error') {
          throw new Error(chunk.error);
        }
      }

      // Add complete assistant message
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: fullResponse, provider: conversation.currentProvider },
      ]);
      setStreamingText('');
      onContextUpdate?.(conversation.contextPercentage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, conversation, handleCommand, onContextUpdate]);

  // Handle keyboard
  useInput(
    (char, key) => {
      if (key.ctrl && char === 'c') {
        exit();
      }
    },
    { isActive: true }
  );

  return (
    <Box flexDirection="column" padding={1}>
      {/* Help panel */}
      {showHelp && (
        <Box borderStyle="single" borderColor={colors.dim} marginBottom={1} padding={1}>
          <Text color={colors.muted}>
            {`Commands:
  /switch <provider>  - Switch AI (anthropic, openai, gemini)
  /status             - Check health of all providers (🟢🟡🔴)
  /providers          - List available providers
  /model              - Show current provider
  /tokens             - Show token usage and context %
  /compact            - Summarize conversation to save context
  /clear              - Clear conversation
  /help               - Toggle this help
  /exit               - Exit`}
          </Text>
        </Box>
      )}

      {/* Messages */}
      <Box flexDirection="column" marginBottom={1}>
        {messages.slice(-20).map((msg, i) => (
          <Box key={i} marginBottom={1}>
            {msg.role === 'user' ? (
              <Box>
                <Text color={colors.accent} bold>
                  you:{' '}
                </Text>
                <Text>{msg.content}</Text>
              </Box>
            ) : msg.role === 'assistant' ? (
              <Box flexDirection="column">
                <Text color={colors.success} bold>
                  {msg.provider || 'ai'}:{' '}
                </Text>
                <Text>{msg.content}</Text>
              </Box>
            ) : (
              <Text color={colors.muted} italic>
                {msg.content}
              </Text>
            )}
          </Box>
        ))}

        {/* Streaming response */}
        {isStreaming && streamingText && (
          <Box flexDirection="column" marginBottom={1}>
            <Text color={colors.success} bold>
              {conversation.currentProvider}:{' '}
            </Text>
            <Text>{streamingText}</Text>
            <Text color={colors.muted}>▌</Text>
          </Box>
        )}
      </Box>

      {/* Error */}
      {error && (
        <Box marginBottom={1}>
          <Text color={colors.error}>Error: {error}</Text>
        </Box>
      )}

      {/* Input */}
      <Box>
        <Text color={colors.accent}>{'> '}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={sendMessage}
          placeholder={isStreaming ? 'Waiting...' : 'Type a message...'}
        />
      </Box>
    </Box>
  );
}
