import { Box, Typography, IconButton } from '@mui/material';
import { Delete } from '@mui/icons-material';
import type { ConsoleEntry } from '../../lib/types';

interface ConsolePanelProps {
  entries: ConsoleEntry[];
  onClear: () => void;
}

const getEntryColor = (type: ConsoleEntry['type']) => {
  switch (type) {
    case 'error':
      return '#f44336';
    case 'warn':
      return '#ff9800';
    case 'info':
      return '#2196f3';
    default:
      return '#e0e0e0';
  }
};

export function ConsolePanel({ entries, onClear }: ConsolePanelProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: '#1a1a1a',
      }}
    >
      <Box
        sx={{
          p: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          Console
        </Typography>
        <IconButton size="small" onClick={onClear} sx={{ color: 'text.secondary' }}>
          <Delete fontSize="small" />
        </IconButton>
      </Box>
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 1,
          fontFamily: 'monospace',
          fontSize: '0.75rem',
        }}
      >
        {entries.length === 0 ? (
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            No output yet
          </Typography>
        ) : (
          entries.map((entry, i) => (
            <Box
              key={i}
              sx={{
                color: getEntryColor(entry.type),
                py: 0.25,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {entry.content}
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}
