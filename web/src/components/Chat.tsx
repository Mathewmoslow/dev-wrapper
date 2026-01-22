import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  Paper,
  CircularProgress,
  LinearProgress,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Send,
  Refresh,
  Delete,
  Compress,
  Save,
} from '@mui/icons-material';
import { useAppStore } from '../stores/app-store';

const providerNames: Record<string, string> = {
  anthropic: 'Claude (Anthropic)',
  openai: 'GPT (OpenAI)',
  gemini: 'Gemini (Google)',
};

export function Chat() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isStreaming,
    streamingContent,
    currentProvider,
    providerHealth,
    contextUsage,
    needsCompaction,
    projectConfig,
    sendMessage,
    clearMessages,
    setCurrentProvider,
    checkProvidersConfigured,
    compactConversation,
    saveConversation,
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
  const contextPercent = Math.round(contextUsage.percentage * 100);

  // Determine context bar color
  const getContextColor = () => {
    if (contextUsage.percentage >= 0.9) return 'error';
    if (contextUsage.percentage >= 0.75) return 'warning';
    return 'primary';
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Chat
          </Typography>
          {projectConfig && (
            <Chip
              label={projectConfig.name}
              size="small"
              variant="outlined"
              sx={{ borderColor: 'primary.main', color: 'primary.main' }}
            />
          )}
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <Select
              value={currentProvider}
              onChange={(e) => setCurrentProvider(e.target.value as 'anthropic' | 'openai' | 'gemini')}
              sx={{
                bgcolor: 'background.paper',
                '& .MuiSelect-select': { py: 0.75, fontSize: '0.875rem' },
              }}
            >
              <MenuItem value="anthropic">Claude</MenuItem>
              <MenuItem value="openai">GPT-4</MenuItem>
              <MenuItem value="gemini">Gemini</MenuItem>
            </Select>
          </FormControl>
          {health && (
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: health.status === 'green' ? 'success.main' : health.status === 'yellow' ? 'warning.main' : 'error.main',
              }}
              title={health.message}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {/* Context usage indicator */}
          <Tooltip title={`Context: ${contextUsage.used.toLocaleString()} / ${contextUsage.max.toLocaleString()} tokens (${contextPercent}%)`}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
              <Box sx={{ width: 60 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(contextPercent, 100)}
                  color={getContextColor()}
                  sx={{ height: 6, borderRadius: 1 }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {contextPercent}%
              </Typography>
            </Box>
          </Tooltip>

          {needsCompaction && (
            <Tooltip title="Context is getting full - click to compact">
              <IconButton
                onClick={compactConversation}
                size="small"
                color="warning"
              >
                <Compress fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title="Save conversation">
            <IconButton
              onClick={() => saveConversation()}
              size="small"
              disabled={messages.length === 0}
            >
              <Save fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Refresh provider status">
            <IconButton
              onClick={checkProvidersConfigured}
              size="small"
            >
              <Refresh fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Clear chat">
            <IconButton
              onClick={clearMessages}
              size="small"
            >
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Messages */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {messages.length === 0 && !isStreaming && (
          <Box sx={{ textAlign: 'center', color: 'text.secondary', mt: 8 }}>
            <Typography variant="h6" gutterBottom>
              {projectConfig ? projectConfig.name : 'Welcome to Studiora Web'}
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Using {providerNames[currentProvider]}
            </Typography>
            {projectConfig ? (
              <Typography variant="body2" sx={{ mb: 2, maxWidth: 400, mx: 'auto' }}>
                {projectConfig.description}
              </Typography>
            ) : (
              <Typography variant="body2">
                Start a conversation or type <code>/help</code> for commands.
              </Typography>
            )}
            <Box sx={{ mt: 4, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
              <Chip label="/help" size="small" onClick={() => setInput('/help')} sx={{ cursor: 'pointer' }} />
              <Chip label="/new" size="small" onClick={() => setInput('/new')} sx={{ cursor: 'pointer' }} />
              <Chip label="/switch" size="small" onClick={() => setInput('/switch ')} sx={{ cursor: 'pointer' }} />
              <Chip label="/context" size="small" onClick={() => setInput('/context')} sx={{ cursor: 'pointer' }} />
            </Box>
          </Box>
        )}

        {messages.map((message, index) => (
          <Box
            key={index}
            sx={{
              display: 'flex',
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
              mb: 2,
            }}
          >
            <Paper
              elevation={0}
              sx={{
                maxWidth: '80%',
                p: 2,
                bgcolor: message.role === 'user' ? 'primary.main' : 'background.paper',
                borderRadius: 2,
              }}
            >
              <Typography
                component="pre"
                sx={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: message.content.startsWith('/') ? 'monospace' : 'inherit',
                  fontSize: '0.875rem',
                  m: 0,
                  color: message.role === 'user' ? 'white' : 'text.primary',
                }}
              >
                {message.content}
              </Typography>
            </Paper>
          </Box>
        ))}

        {isStreaming && streamingContent && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
            <Paper
              elevation={0}
              sx={{
                maxWidth: '80%',
                p: 2,
                bgcolor: 'background.paper',
                borderRadius: 2,
              }}
            >
              <Typography
                component="pre"
                sx={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                  m: 0,
                }}
              >
                {streamingContent}
                <Box
                  component="span"
                  sx={{
                    display: 'inline-block',
                    width: 8,
                    height: 16,
                    bgcolor: 'text.secondary',
                    ml: 0.5,
                    animation: 'pulse 1s infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.4 },
                    },
                  }}
                />
              </Typography>
            </Paper>
          </Box>
        )}

        {isStreaming && !streamingContent && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
            <Paper
              elevation={0}
              sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2 }}
            >
              <CircularProgress size={20} />
            </Paper>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Input */}
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message or /command..."
            disabled={isStreaming}
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'background.paper',
                fontFamily: input.startsWith('/') ? 'monospace' : 'inherit',
              },
            }}
          />
          <IconButton
            type="submit"
            disabled={isStreaming || !input.trim()}
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              '&:hover': { bgcolor: 'primary.dark' },
              '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
            }}
          >
            {isStreaming ? <CircularProgress size={20} color="inherit" /> : <Send />}
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}
