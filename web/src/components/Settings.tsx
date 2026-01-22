import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  IconButton,
  FormControl,
  Select,
  MenuItem,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Key,
  FolderOpen,
  GitHub,
  Refresh,
  Check,
  Close,
} from '@mui/icons-material';
import { useAppStore } from '../stores/app-store';

export function Settings() {
  const {
    googleAccessToken,
    githubToken,
    driveProjectFolderId,
    githubRepo,
    repos,
    providerHealth,
    providersConfigured,
    setDriveFolder,
    setGithubRepo,
    checkProvidersConfigured,
    loadGithubRepos,
  } = useAppStore();

  const [localDriveFolderId, setLocalDriveFolderId] = useState(driveProjectFolderId);

  useEffect(() => {
    if (githubToken) {
      loadGithubRepos();
    }
  }, [githubToken]);

  // Extract folder ID from a Google Drive URL or return as-is if already just the ID
  const extractFolderId = (input: string): string => {
    if (!input) return '';

    // Match patterns like:
    // https://drive.google.com/drive/folders/1IGkfcakXOrrCFprqY3Ff8RCOIGi7WgLs
    // https://drive.google.com/drive/folders/1IGkfcakXOrrCFprqY3Ff8RCOIGi7WgLs?dmr=1&ec=wgc-drive-globalnav-goto
    // https://drive.google.com/drive/u/0/folders/1IGkfcakXOrrCFprqY3Ff8RCOIGi7WgLs
    const match = input.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];

    // Otherwise return as-is (assume it's already just the ID)
    return input.trim();
  };

  const handleSaveDriveFolder = () => {
    const folderId = extractFolderId(localDriveFolderId);
    setLocalDriveFolderId(folderId); // Update the display to show just the ID
    setDriveFolder(folderId);
  };

  return (
    <Box sx={{ height: '100%', bgcolor: 'background.default', overflow: 'auto' }}>
      <Box sx={{ maxWidth: 600, mx: 'auto', p: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 4 }}>
          Settings
        </Typography>

        {/* AI Provider Status */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Key />
              <Typography variant="h6">AI Providers</Typography>
            </Box>
            <IconButton onClick={checkProvidersConfigured} size="small" title="Refresh status">
              <Refresh />
            </IconButton>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            API keys are configured server-side for security. Contact your admin to enable providers.
          </Typography>

          <List dense disablePadding>
            {(['anthropic', 'openai', 'gemini'] as const).map((provider) => {
              const health = providerHealth[provider];
              const configured = providersConfigured[provider];
              const names: Record<string, string> = {
                anthropic: 'Anthropic (Claude)',
                openai: 'OpenAI (GPT)',
                gemini: 'Google (Gemini)',
              };

              return (
                <ListItem key={provider} disablePadding sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {configured ? (
                      <Check sx={{ color: 'success.main', fontSize: 20 }} />
                    ) : (
                      <Close sx={{ color: 'error.main', fontSize: 20 }} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={names[provider]}
                    secondary={health?.message || (configured ? 'Configured' : 'Not configured')}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{
                      variant: 'caption',
                      sx: { color: configured ? 'success.main' : 'error.main' },
                    }}
                  />
                </ListItem>
              );
            })}
          </List>
        </Paper>

        {/* Google Drive */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <FolderOpen />
            <Typography variant="h6">Google Drive Project Folder</Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Paste the Google Drive folder URL or ID where your project files are stored.
            The folder ID will be automatically extracted from URLs.
          </Typography>

          {googleAccessToken ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                value={localDriveFolderId}
                onChange={(e) => setLocalDriveFolderId(e.target.value)}
                placeholder="Paste folder URL or ID..."
                sx={{
                  '& .MuiInputBase-input': { fontFamily: 'monospace' },
                }}
              />
              <Button variant="contained" onClick={handleSaveDriveFolder}>
                Save
              </Button>
            </Box>
          ) : (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Connect Google Drive first (in Connections)
            </Alert>
          )}
        </Paper>

        {/* GitHub Repository */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <GitHub />
            <Typography variant="h6">GitHub Repository</Typography>
          </Box>

          {githubToken ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select the repository for git operations
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="">Select a repository...</MenuItem>
                  {repos.map((repo) => (
                    <MenuItem key={repo.id} value={repo.full_name}>
                      {repo.full_name} {repo.private && '(private)'}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </>
          ) : (
            <Alert severity="warning">
              Connect GitHub first (in Connections)
            </Alert>
          )}
        </Paper>

        {/* Info */}
        <Paper sx={{ p: 3, bgcolor: 'action.hover' }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            How it works:
          </Typography>
          <List dense disablePadding>
            <ListItem disablePadding sx={{ py: 0.25 }}>
              <Typography variant="body2" color="text.secondary">
                Files are stored in your Google Drive and sync to your local machine
              </Typography>
            </ListItem>
            <ListItem disablePadding sx={{ py: 0.25 }}>
              <Typography variant="body2" color="text.secondary">
                Git operations go through GitHub's API - no local git needed
              </Typography>
            </ListItem>
            <ListItem disablePadding sx={{ py: 0.25 }}>
              <Typography variant="body2" color="text.secondary">
                AI API keys are stored securely on the server
              </Typography>
            </ListItem>
            <ListItem disablePadding sx={{ py: 0.25 }}>
              <Typography variant="body2" color="text.secondary">
                OAuth tokens are stored in your browser's local storage
              </Typography>
            </ListItem>
          </List>
        </Paper>
      </Box>
    </Box>
  );
}
