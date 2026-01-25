import { useEffect } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { useAppStore } from './stores/app-store';
import { Auth } from './components/Auth';
import { IDE } from './components/IDE';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider, useToast, setGlobalToast } from './components/ToastProvider';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#0078d4' },
    secondary: { main: '#f48fb1' },
    background: { default: '#1e1e1e', paper: '#252526' },
  },
  typography: {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
});

function AppContent() {
  const { view, setView, checkProvidersConfigured, googleAccessToken } = useAppStore();
  const toast = useToast();

  useEffect(() => {
    setGlobalToast(toast);
  }, [toast]);

  useEffect(() => {
    checkProvidersConfigured();
  }, [checkProvidersConfigured]);

  // Auto-redirect to IDE after auth
  useEffect(() => {
    if (googleAccessToken && view === 'auth') {
      setView('workspace');
    }
  }, [googleAccessToken, view, setView]);

  // Show auth if no Google token
  if (!googleAccessToken) {
    return (
      <ErrorBoundary>
        <Auth />
      </ErrorBoundary>
    );
  }

  // Main IDE view
  return (
    <ErrorBoundary>
      <IDE />
    </ErrorBoundary>
  );
}

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <ErrorBoundary>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
