import { useEffect } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box } from '@mui/material';
import { useAppStore } from './stores/app-store';
import { Sidebar } from './components/Sidebar';
import { Chat } from './components/Chat';
import { FileExplorer } from './components/FileExplorer';
import { Settings } from './components/Settings';
import { Auth } from './components/Auth';
import { ProjectInit } from './components/ProjectInit';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

function App() {
  const { view, checkProvidersConfigured, googleAccessToken, githubToken } = useAppStore();

  useEffect(() => {
    checkProvidersConfigured();
  }, []);

  const showAuth = view === 'auth' || (!googleAccessToken && !githubToken);

  if (showAuth) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Auth />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh' }}>
        <Sidebar />
        <Box component="main" sx={{ flexGrow: 1, overflow: 'hidden' }}>
          {view === 'chat' && <Chat />}
          {view === 'files' && <FileExplorer />}
          {view === 'settings' && <Settings />}
          {view === 'init' && <ProjectInit />}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
