import { useEffect, useRef, useState, useCallback } from 'react';
import { WebContainer } from '@webcontainer/api';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

// Singleton WebContainer
let webcontainerInstance: WebContainer | null = null;
let webcontainerBooting: Promise<WebContainer> | null = null;

async function getWebContainer(): Promise<WebContainer> {
  if (webcontainerInstance) return webcontainerInstance;
  if (webcontainerBooting) return webcontainerBooting;

  webcontainerBooting = WebContainer.boot();
  webcontainerInstance = await webcontainerBooting;
  return webcontainerInstance;
}

interface UseWebContainerOptions {
  onServerReady?: (url: string) => void;
  onError?: (error: Error) => void;
}

interface UseWebContainerReturn {
  container: WebContainer | null;
  containerReady: boolean;
  serverUrl: string | null;
  terminalRef: React.RefObject<HTMLDivElement | null>;
  terminalInstance: Terminal | null;
  fitAddon: FitAddon | null;
  shellInput: WritableStreamDefaultWriter | null;
  writeFile: (path: string, content: string) => Promise<void>;
  readFile: (path: string) => Promise<string>;
  listFiles: (dir?: string) => Promise<string[]>;
  runCommand: (cmd: string) => Promise<void>;
  initTerminal: () => void;
  refitTerminal: () => void;
}

export function useWebContainer(options: UseWebContainerOptions = {}): UseWebContainerReturn {
  const { onServerReady, onError } = options;

  const [container, setContainer] = useState<WebContainer | null>(null);
  const [containerReady, setContainerReady] = useState(false);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [terminalInstance, setTerminalInstance] = useState<Terminal | null>(null);
  const [fitAddon, setFitAddon] = useState<FitAddon | null>(null);

  const terminalRef = useRef<HTMLDivElement>(null);
  const shellInputRef = useRef<WritableStreamDefaultWriter | null>(null);
  const terminalInitializedRef = useRef(false);

  // Boot WebContainer
  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        const wc = await getWebContainer();
        if (!mounted) return;

        setContainer(wc);
        setContainerReady(true);

        wc.on('server-ready', (_port: number, url: string) => {
          setServerUrl(url);
          onServerReady?.(url);
        });

        // Initialize with a basic package.json
        await wc.mount({
          'package.json': {
            file: {
              contents: JSON.stringify({
                name: 'workspace',
                type: 'module',
                scripts: {
                  dev: 'echo "No dev script configured"',
                  start: 'echo "No start script configured"'
                }
              }, null, 2)
            }
          }
        });
      } catch (err) {
        console.error('WebContainer boot failed:', err);
        onError?.(err as Error);
      }
    }

    boot();
    return () => { mounted = false; };
  }, [onServerReady, onError]);

  // Initialize terminal
  const initTerminal = useCallback(() => {
    if (!terminalRef.current || terminalInitializedRef.current) return;

    const terminal = new Terminal({
      theme: {
        background: '#0a0a0a',
        foreground: '#e0e0e0',
        cursor: '#ffffff',
      },
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
    });

    const addon = new FitAddon();
    terminal.loadAddon(addon);
    terminal.open(terminalRef.current);
    addon.fit();

    setTerminalInstance(terminal);
    setFitAddon(addon);
    terminalInitializedRef.current = true;

    terminal.writeln('\x1b[33mWorkspace Terminal\x1b[0m');
    terminal.writeln('Booting WebContainer...');

    // Start shell if container is ready
    if (container) {
      startShell(container, terminal);
    }

    const handleResize = () => addon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [container]);

  // Start shell when container becomes ready
  useEffect(() => {
    if (containerReady && terminalInstance && container && !shellInputRef.current) {
      startShell(container, terminalInstance);
    }
  }, [containerReady, terminalInstance, container]);

  const startShell = async (wc: WebContainer, terminal: Terminal) => {
    terminal.writeln('\x1b[32mWebContainer ready!\x1b[0m\n');

    const shellProcess = await wc.spawn('jsh', {
      terminal: { cols: terminal.cols, rows: terminal.rows },
    });

    shellProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          terminal.write(data);
        },
      })
    );

    const input = shellProcess.input.getWriter();
    shellInputRef.current = input;

    terminal.onData((data) => {
      input.write(data);
    });

    terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
      shellProcess.resize({ cols, rows });
    });
  };

  const refitTerminal = useCallback(() => {
    fitAddon?.fit();
  }, [fitAddon]);

  // File operations
  const writeFile = useCallback(async (path: string, content: string) => {
    if (!container) throw new Error('Container not ready');

    // Ensure directory exists
    const dir = path.split('/').slice(0, -1).join('/');
    if (dir) {
      try {
        const mkdirProcess = await container.spawn('mkdir', ['-p', dir]);
        await mkdirProcess.exit;
      } catch (e) {
        console.error('mkdir failed:', e);
      }
    }

    await container.fs.writeFile(path, content);
  }, [container]);

  const readFile = useCallback(async (path: string): Promise<string> => {
    if (!container) return '';
    try {
      const content = await container.fs.readFile(path, 'utf-8');
      return content;
    } catch {
      return '';
    }
  }, [container]);

  const listFiles = useCallback(async (dir: string = '.'): Promise<string[]> => {
    if (!container) return [];
    try {
      const entries = await container.fs.readdir(dir, { withFileTypes: true });
      const fileList: string[] = [];
      for (const entry of entries) {
        const path = dir === '.' ? entry.name : `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            const subFiles = await listFiles(path);
            fileList.push(...subFiles);
          }
        } else {
          fileList.push(path);
        }
      }
      return fileList;
    } catch {
      return [];
    }
  }, [container]);

  const runCommand = useCallback(async (cmd: string) => {
    if (!shellInputRef.current) return;
    await shellInputRef.current.write(cmd + '\n');
  }, []);

  return {
    container,
    containerReady,
    serverUrl,
    terminalRef,
    terminalInstance,
    fitAddon,
    shellInput: shellInputRef.current,
    writeFile,
    readFile,
    listFiles,
    runCommand,
    initTerminal,
    refitTerminal,
  };
}
