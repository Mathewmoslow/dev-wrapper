import { useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Link,
} from '@mui/material';
import {
  FolderOpen,
  GitHub,
  Check,
  OpenInNew,
} from '@mui/icons-material';
import { useAppStore } from '../stores/app-store';
import { getGoogleAuthUrl, parseGoogleAuthResponse } from '../lib/google-drive';

export function Auth() {
  const {
    googleAccessToken,
    githubToken,
    setGoogleToken,
    setGithubToken,
    setView,
  } = useAppStore();

  // Handle OAuth callback
  useEffect(() => {
    if (window.location.hash) {
      const authResult = parseGoogleAuthResponse(window.location.hash);
      if (authResult) {
        setGoogleToken(authResult.accessToken);
        // Clear the hash
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

  const handleGoogleAuth = () => {
    const redirectUri = window.location.origin + window.location.pathname;
    window.location.href = getGoogleAuthUrl(redirectUri);
  };

  const handleGitHubTokenInput = () => {
    const token = prompt(
      'Enter your GitHub Personal Access Token:\n\n' +
      'Create one at: https://github.com/settings/tokens\n' +
      'Required scopes: repo, user'
    );
    if (token) {
      setGithubToken(token);
    }
  };

  const isReady = googleAccessToken && githubToken;

  return (
    <Box
      sx={{
        height: '100%',
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box sx={{ maxWidth: 400, width: '100%', p: 3 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Studiora Web
          </Typography>
          <Typography variant="body1" color="text.secondary">
            AI-powered development from anywhere
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Google Drive Connection */}
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    p: 1,
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                    display: 'flex',
                  }}
                >
                  <FolderOpen sx={{ color: '#fbbf24' }} />
                </Box>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                    Google Drive
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    File storage & sync
                  </Typography>
                </Box>
              </Box>
              {googleAccessToken && <Check sx={{ color: 'success.main' }} />}
            </Box>

            {googleAccessToken ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ color: 'success.main' }}>
                  Connected
                </Typography>
                <Button
                  size="small"
                  onClick={() => setGoogleToken('')}
                  sx={{ textTransform: 'none' }}
                >
                  Disconnect
                </Button>
              </Box>
            ) : (
              <Button
                fullWidth
                variant="contained"
                onClick={handleGoogleAuth}
              >
                Connect Google Drive
              </Button>
            )}
          </Paper>

          {/* GitHub Connection */}
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    p: 1,
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                    display: 'flex',
                  }}
                >
                  <GitHub />
                </Box>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                    GitHub
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Git operations & repos
                  </Typography>
                </Box>
              </Box>
              {githubToken && <Check sx={{ color: 'success.main' }} />}
            </Box>

            {githubToken ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ color: 'success.main' }}>
                  Connected
                </Typography>
                <Button
                  size="small"
                  onClick={() => setGithubToken('')}
                  sx={{ textTransform: 'none' }}
                >
                  Disconnect
                </Button>
              </Box>
            ) : (
              <>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleGitHubTokenInput}
                  sx={{ mb: 1 }}
                >
                  Enter Personal Access Token
                </Button>
                <Box sx={{ textAlign: 'center' }}>
                  <Link
                    href="https://github.com/settings/tokens/new?description=Studiora%20Web&scopes=repo,user"
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      fontSize: '0.875rem',
                    }}
                  >
                    Create a token <OpenInNew sx={{ fontSize: 14 }} />
                  </Link>
                </Box>
              </>
            )}
          </Paper>
        </Box>

        {/* Continue Button */}
        {isReady && (
          <Button
            fullWidth
            variant="contained"
            color="success"
            size="large"
            onClick={() => setView('chat')}
            sx={{ mt: 3 }}
          >
            Continue to Chat
          </Button>
        )}

        {/* Info */}
        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Typography variant="caption" color="text.secondary">
            Your credentials are stored locally in your browser.
          </Typography>
          <br />
          <Typography variant="caption" color="text.secondary">
            Nothing is sent to external servers except the AI providers.
          </Typography>
        </Box>

        {/* Skip for now */}
        {!isReady && (
          <Button
            fullWidth
            onClick={() => setView('settings')}
            sx={{ mt: 2, textTransform: 'none' }}
          >
            Skip for now (limited features)
          </Button>
        )}
      </Box>
    </Box>
  );
}
