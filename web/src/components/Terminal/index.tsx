import { Box, Typography } from '@mui/material';
import { Terminal as TerminalIcon, Folder } from '@mui/icons-material';
import { WebContainerTerminal } from './WebContainerTerminal';
import { useAppStore } from '../../stores/app-store';

export function TerminalView() {
  const { driveProjectFolderId, googleAccessToken } = useAppStore();

  if (!googleAccessToken) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 2,
        }}
      >
        <TerminalIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
        <Typography color="text.secondary">
          Connect to Google Drive to use the terminal
        </Typography>
      </Box>
    );
  }

  if (!driveProjectFolderId) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 2,
        }}
      >
        <Folder sx={{ fontSize: 64, color: 'text.disabled' }} />
        <Typography color="text.secondary">
          Select a project folder in Settings first
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <TerminalIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h6">Terminal</Typography>
        <Typography variant="body2" color="text.secondary">
          Full Node.js environment with npm support
        </Typography>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0 }}>
        <WebContainerTerminal
          onServerReady={(url) => console.log('Server ready:', url)}
        />
      </Box>
    </Box>
  );
}

export { WebContainerTerminal } from './WebContainerTerminal';
