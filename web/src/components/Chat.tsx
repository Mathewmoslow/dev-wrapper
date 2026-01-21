import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Trash2, RefreshCw } from 'lucide-react';
import { useAppStore } from '../stores/app-store';
import { getProviderDisplayName } from '../providers';

export function Chat() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isStreaming,
    streamingContent,
    currentProvider,
    providerHealth,
    sendMessage,
    clearMessages,
    setCurrentProvider,
    checkAllProviders,
  } = useAppStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const message = input;
    setInput('');

    try {
      await sendMessage(message);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const health = providerHealth[currentProvider];

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white">Chat</h2>
          <select
            value={currentProvider}
            onChange={(e) => setCurrentProvider(e.target.value as 'anthropic' | 'openai' | 'gemini')}
            className="bg-gray-800 text-white px-3 py-1 rounded border border-gray-700 text-sm"
          >
            <option value="anthropic">Claude (Anthropic)</option>
            <option value="openai">GPT (OpenAI)</option>
            <option value="gemini">Gemini (Google)</option>
          </select>
          {health && (
            <span
              className={`text-sm ${
                health.status === 'green'
                  ? 'text-green-400'
                  : health.status === 'yellow'
                  ? 'text-yellow-400'
                  : 'text-red-400'
              }`}
            >
              {health.status === 'green' ? '●' : health.status === 'yellow' ? '●' : '●'} {health.message}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={checkAllProviders}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
            title="Check provider health"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={clearMessages}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
            title="Clear chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isStreaming && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg">Welcome to Studiora Web</p>
            <p className="text-sm mt-2">
              Using {getProviderDisplayName(currentProvider)}
            </p>
            <p className="text-sm mt-4">
              Start a conversation or open a file to get context-aware assistance.
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-100'
              }`}
            >
              <pre className="whitespace-pre-wrap font-sans text-sm">{message.content}</pre>
            </div>
          </div>
        ))}

        {isStreaming && streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg p-3 bg-gray-800 text-gray-100">
              <pre className="whitespace-pre-wrap font-sans text-sm">{streamingContent}</pre>
              <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
            </div>
          </div>
        )}

        {isStreaming && !streamingContent && (
          <div className="flex justify-start">
            <div className="rounded-lg p-3 bg-gray-800">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isStreaming}
            className="flex-1 bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStreaming ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
