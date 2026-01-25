import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, CircularProgress, Button, IconButton } from '@mui/material';
import { PlayArrow, Refresh, FolderOpen } from '@mui/icons-material';
import { WebContainer } from '@webcontainer/api';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

// Singleton WebContainer instance
let webcontainerInstance: WebContainer | null = null;
let webcontainerBooting: Promise<WebContainer> | null = null;

async function getWebContainer(): Promise<WebContainer> {
  if (webcontainerInstance) return webcontainerInstance;

  if (webcontainerBooting) return webcontainerBooting;

  webcontainerBooting = WebContainer.boot();
  webcontainerInstance = await webcontainerBooting;
  return webcontainerInstance;
}

interface WebContainerTerminalProps {
  files?: Record<string, string>;
  onServerReady?: (url: string) => void;
}

export function WebContainerTerminal({ files, onServerReady }: WebContainerTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [container, setContainer] = useState<WebContainer | null>(null);
  const shellProcessRef = useRef<{ kill: () => void } | null>(null);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || terminalInstanceRef.current) return;

    const terminal = new Terminal({
      theme: {
        background: '#1a1a1a',
        foreground: '#e0e0e0',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selectionBackground: '#555555',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#6272a4',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#f8f8f2',
      },
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);
    fitAddon.fit();

    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
      terminalInstanceRef.current = null;
    };
  }, []);

  // Boot WebContainer
  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        const terminal = terminalInstanceRef.current;
        if (terminal) {
          terminal.writeln('\x1b[33mBooting WebContainer...\x1b[0m');
        }

        const wc = await getWebContainer();

        if (!mounted) return;

        setContainer(wc);
        setLoading(false);

        if (terminal) {
          terminal.writeln('\x1b[32mWebContainer ready!\x1b[0m');
          terminal.writeln('');
        }

        // Listen for server-ready event
        wc.on('server-ready', (_port: number, url: string) => {
          setServerUrl(url);
          onServerReady?.(url);
          if (terminal) {
            terminal.writeln(`\x1b[32mServer ready at ${url}\x1b[0m`);
          }
        });

        // Start shell
        await startShell(wc);
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : 'Failed to boot WebContainer';
        setError(message);
        setLoading(false);
        terminalInstanceRef.current?.writeln(`\x1b[31mError: ${message}\x1b[0m`);
      }
    }

    boot();

    return () => {
      mounted = false;
    };
  }, [onServerReady]);

  // Start interactive shell
  const startShell = useCallback(async (wc: WebContainer) => {
    const terminal = terminalInstanceRef.current;
    if (!terminal) return;

    const shellProcess = await wc.spawn('jsh', {
      terminal: {
        cols: terminal.cols,
        rows: terminal.rows,
      },
    });

    shellProcessRef.current = shellProcess;

    // Pipe shell output to terminal
    shellProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          terminal.write(data);
        },
      })
    );

    // Pipe terminal input to shell
    const input = shellProcess.input.getWriter();
    terminal.onData((data) => {
      input.write(data);
    });

    // Handle terminal resize
    terminal.onResize(({ cols, rows }) => {
      shellProcess.resize({ cols, rows });
    });

    return shellProcess;
  }, []);

  // Mount files to WebContainer
  const mountFiles = useCallback(async () => {
    if (!container || !files) return;

    const terminal = terminalInstanceRef.current;
    terminal?.writeln('\x1b[33mMounting project files...\x1b[0m');

    // Convert flat file map to WebContainer file tree
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fileTree: any = {};

    for (const [path, contents] of Object.entries(files)) {
      const parts = path.split('/').filter(Boolean);
      let current = fileTree;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = { directory: {} };
        }
        current = current[part].directory;
      }

      const fileName = parts[parts.length - 1];
      current[fileName] = { file: { contents } };
    }

    await container.mount(fileTree);
    terminal?.writeln('\x1b[32mFiles mounted!\x1b[0m');
    terminal?.writeln('');
  }, [container, files]);

  // Run npm install
  const runNpmInstall = useCallback(async () => {
    if (!container) return;

    const terminal = terminalInstanceRef.current;
    terminal?.writeln('\x1b[33mRunning npm install...\x1b[0m');

    const installProcess = await container.spawn('npm', ['install']);

    installProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          terminal?.write(data);
        },
      })
    );

    const exitCode = await installProcess.exit;

    if (exitCode === 0) {
      terminal?.writeln('\x1b[32mnpm install completed!\x1b[0m');
    } else {
      terminal?.writeln(`\x1b[31mnpm install failed with code ${exitCode}\x1b[0m`);
    }
  }, [container]);

  // Run npm start/dev
  const runDevServer = useCallback(async () => {
    if (!container) return;

    const terminal = terminalInstanceRef.current;
    terminal?.writeln('\x1b[33mStarting dev server...\x1b[0m');

    // Try npm run dev first, then npm start
    const devProcess = await container.spawn('npm', ['run', 'dev']);

    devProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          terminal?.write(data);
        },
      })
    );
  }, [container]);

  // Restart shell
  const restartShell = useCallback(async () => {
    if (!container) return;

    shellProcessRef.current?.kill();
    terminalInstanceRef.current?.clear();
    await startShell(container);
  }, [container, startShell]);

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 2,
          p: 3,
        }}
      >
        <Typography color="error" variant="h6">
          WebContainer Error
        </Typography>
        <Typography color="text.secondary" textAlign="center">
          {error}
        </Typography>
        <Typography variant="caption" color="text.disabled" textAlign="center">
          Note: WebContainers require specific browser headers (COOP/COEP).
          Make sure your server is configured correctly.
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
          flexWrap: 'wrap',
        }}
      >
        <Button
          size="small"
          variant="outlined"
          startIcon={<FolderOpen />}
          onClick={mountFiles}
          disabled={loading || !files}
        >
          Mount Files
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={runNpmInstall}
          disabled={loading}
        >
          npm install
        </Button>
        <Button
          size="small"
          variant="contained"
          startIcon={<PlayArrow />}
          onClick={runDevServer}
          disabled={loading}
        >
          npm run dev
        </Button>
        <IconButton size="small" onClick={restartShell} disabled={loading} title="Restart shell">
          <Refresh fontSize="small" />
        </IconButton>

        {serverUrl && (
          <Typography variant="caption" sx={{ ml: 'auto', color: 'success.main' }}>
            Server: {serverUrl}
          </Typography>
        )}
      </Box>

      {/* Terminal */}
      <Box
        sx={{
          flex: 1,
          bgcolor: '#1a1a1a',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(0,0,0,0.7)',
              zIndex: 10,
              gap: 2,
            }}
          >
            <CircularProgress />
            <Typography color="text.secondary">
              Booting WebContainer...
            </Typography>
          </Box>
        )}
        <Box
          ref={terminalRef}
          sx={{
            height: '100%',
            width: '100%',
            '& .xterm': {
              height: '100%',
              padding: '8px',
            },
          }}
        />
      </Box>

      {/* Preview iframe for server output */}
      {serverUrl && (
        <Box
          sx={{
            height: '40%',
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <iframe
            src={serverUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              backgroundColor: '#fff',
            }}
            title="Preview"
          />
        </Box>
      )}
    </Box>
  );
}
