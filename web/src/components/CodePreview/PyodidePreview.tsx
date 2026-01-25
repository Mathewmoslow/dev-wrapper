import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { PlayArrow, Stop } from '@mui/icons-material';
import type { ConsoleEntry } from '../../lib/types';

// Dynamic import type for Pyodide
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PyodideInterface = any;

interface PyodidePreviewProps {
  files: Record<string, string>;
  entryFile: string;
  onConsoleMessage: (entry: ConsoleEntry) => void;
  onError: (error: string | null) => void;
  onRunningChange: (running: boolean) => void;
}

// Singleton for Pyodide instance
let pyodideInstance: PyodideInterface = null;
let pyodideLoading: Promise<PyodideInterface> | null = null;

async function loadPyodideInstance(): Promise<PyodideInterface> {
  if (pyodideInstance) return pyodideInstance;

  if (pyodideLoading) return pyodideLoading;

  pyodideLoading = (async () => {
    // Load Pyodide from CDN
    const { loadPyodide } = await import('pyodide');
    const instance = await loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/',
    });
    pyodideInstance = instance;
    return instance;
  })();

  return pyodideLoading;
}

export function PyodidePreview({
  files,
  entryFile,
  onConsoleMessage,
  onError,
  onRunningChange,
}: PyodidePreviewProps) {
  const [loading, setLoading] = useState(false);
  const [pyodideReady, setPyodideReady] = useState(!!pyodideInstance);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const abortRef = useRef(false);

  // Load Pyodide on mount
  useEffect(() => {
    if (!pyodideReady) {
      setLoading(true);
      loadPyodideInstance()
        .then(() => {
          setPyodideReady(true);
          setLoading(false);
        })
        .catch((err) => {
          onError(`Failed to load Python runtime: ${err.message}`);
          setLoading(false);
        });
    }
  }, [pyodideReady, onError]);

  const runPython = useCallback(async () => {
    if (!pyodideInstance) return;

    const code = files[entryFile] || Object.values(files)[0] || '';
    if (!code.trim()) {
      onError('No code to run');
      return;
    }

    setRunning(true);
    onRunningChange(true);
    onError(null);
    setOutput([]);
    abortRef.current = false;

    try {
      // Set up stdout/stderr capture
      await pyodideInstance.runPythonAsync(`
import sys
from io import StringIO

class OutputCapture:
    def __init__(self):
        self.output = []

    def write(self, text):
        if text.strip():
            self.output.append(text)

    def flush(self):
        pass

    def getvalue(self):
        return '\\n'.join(self.output)

_stdout_capture = OutputCapture()
_stderr_capture = OutputCapture()
sys.stdout = _stdout_capture
sys.stderr = _stderr_capture
`);

      // Try to load any required packages
      try {
        await pyodideInstance.loadPackagesFromImports(code);
      } catch {
        // Ignore package loading errors, user might not need external packages
      }

      // Run the code
      await pyodideInstance.runPythonAsync(code);

      // Get captured output
      const stdout = pyodideInstance.runPython('_stdout_capture.getvalue()') as string;
      const stderr = pyodideInstance.runPython('_stderr_capture.getvalue()') as string;

      if (stdout) {
        stdout.split('\n').forEach((line) => {
          if (line.trim()) {
            onConsoleMessage({ type: 'log', content: line, timestamp: Date.now() });
          }
        });
        setOutput((prev) => [...prev, stdout]);
      }

      if (stderr) {
        stderr.split('\n').forEach((line) => {
          if (line.trim()) {
            onConsoleMessage({ type: 'error', content: line, timestamp: Date.now() });
          }
        });
      }

      // Reset stdout/stderr
      await pyodideInstance.runPythonAsync(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      onError(errorMsg);
      onConsoleMessage({ type: 'error', content: errorMsg, timestamp: Date.now() });
    } finally {
      setRunning(false);
      onRunningChange(false);
    }
  }, [files, entryFile, onConsoleMessage, onError, onRunningChange]);

  const stopExecution = useCallback(() => {
    abortRef.current = true;
    setRunning(false);
    onRunningChange(false);
  }, [onRunningChange]);

  if (loading) {
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
        <CircularProgress size={40} />
        <Typography variant="body2" color="text.secondary">
          Loading Python runtime...
        </Typography>
        <Typography variant="caption" color="text.disabled">
          This may take a moment on first load (~10MB)
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <Box
        sx={{
          p: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Button
          size="small"
          variant="contained"
          color={running ? 'error' : 'primary'}
          startIcon={running ? <Stop /> : <PlayArrow />}
          onClick={running ? stopExecution : runPython}
          disabled={!pyodideReady}
        >
          {running ? 'Stop' : 'Run'}
        </Button>
        <Typography variant="caption" color="text.secondary">
          Python 3.11 (Pyodide)
        </Typography>
      </Box>

      {/* Output area */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          bgcolor: '#1a1a1a',
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          whiteSpace: 'pre-wrap',
        }}
      >
        {output.length === 0 ? (
          <Typography variant="body2" color="text.disabled">
            Click "Run" to execute Python code
          </Typography>
        ) : (
          output.map((line, i) => (
            <Box key={i} sx={{ color: '#e0e0e0' }}>
              {line}
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}
