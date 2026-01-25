import { Box, Typography, IconButton } from '@mui/material';
import { Close, Code } from '@mui/icons-material';
import { SandpackPreview } from './SandpackPreview';
import { PyodidePreview } from './PyodidePreview';
import { ConsolePanel } from './ConsolePanel';
import { useAppStore } from '../../stores/app-store';

export function CodePreview() {
  const {
    previewState,
    previewPanelOpen,
    togglePreviewPanel,
    addToConsole,
    clearConsole,
    setPreviewError,
    setPreviewRunning,
  } = useAppStore();

  const { mode, files, entryFile, consoleOutput, error } = previewState;

  if (!previewPanelOpen) return null;

  const getModeLabel = () => {
    switch (mode) {
      case 'sandpack-react':
        return 'React';
      case 'sandpack-vanilla':
        return 'HTML/JS';
      case 'pyodide':
        return 'Python';
      default:
        return 'Preview';
    }
  };

  const renderPreview = () => {
    if (mode === 'none' || Object.keys(files).length === 0) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 2,
            color: 'text.secondary',
          }}
        >
          <Code sx={{ fontSize: 48 }} />
          <Typography>Select a runnable file to preview</Typography>
          <Typography variant="caption" color="text.disabled">
            Supported: .jsx, .tsx, .html, .js, .css, .py
          </Typography>
        </Box>
      );
    }

    if (mode === 'sandpack-react' || mode === 'sandpack-vanilla') {
      return (
        <SandpackPreview
          mode={mode}
          files={files}
          entryFile={entryFile}
          onConsoleMessage={addToConsole}
        />
      );
    }

    if (mode === 'pyodide') {
      return (
        <PyodidePreview
          files={files}
          entryFile={entryFile}
          onConsoleMessage={addToConsole}
          onError={setPreviewError}
          onRunningChange={setPreviewRunning}
        />
      );
    }

    return null;
  };

  return (
    <Box
      sx={{
        width: 400,
        minWidth: 300,
        maxWidth: 600,
        borderLeft: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Code fontSize="small" sx={{ color: 'primary.main' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {getModeLabel()} Preview
          </Typography>
        </Box>
        <IconButton size="small" onClick={togglePreviewPanel}>
          <Close fontSize="small" />
        </IconButton>
      </Box>

      {/* Error banner */}
      {error && (
        <Box
          sx={{
            p: 1,
            bgcolor: 'error.dark',
            color: 'error.contrastText',
          }}
        >
          <Typography variant="caption">{error}</Typography>
        </Box>
      )}

      {/* Preview content */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {renderPreview()}
      </Box>

      {/* Console (for Sandpack, Pyodide has its own) */}
      {mode !== 'pyodide' && mode !== 'none' && (
        <Box sx={{ height: 150, borderTop: '1px solid', borderColor: 'divider' }}>
          <ConsolePanel entries={consoleOutput} onClear={clearConsole} />
        </Box>
      )}
    </Box>
  );
}

// Export individual components for flexibility
export { SandpackPreview } from './SandpackPreview';
export { PyodidePreview } from './PyodidePreview';
export { ConsolePanel } from './ConsolePanel';
