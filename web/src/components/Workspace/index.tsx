import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  CircularProgress,
  BottomNavigation,
  BottomNavigationAction,
  useMediaQuery,
  useTheme,
  Fab,
  Drawer,
  Chip,
} from '@mui/material';
import {
  Send,
  Save,
  Terminal as TerminalIcon,
  Code,
  CloudSync,
  Chat as ChatIcon,
  Preview as PreviewIcon,
  Close,
  DragIndicator,
  Folder,
  Add,
  Remove,
  Refresh,
  MoreVert,
  FolderOpen,
  AutoAwesome,
} from '@mui/icons-material';
import { WebContainer } from '@webcontainer/api';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useAppStore } from '../../stores/app-store';
import { GoogleDriveClient } from '../../lib/google-drive';
import Editor from '@monaco-editor/react';
import { ProjectWizard } from '../ProjectWizard';
import { ProjectPicker } from '../ProjectPicker';

// Get language from file extension for Monaco
function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    css: 'css',
    html: 'html',
    md: 'markdown',
    py: 'python',
    yaml: 'yaml',
    yml: 'yaml',
  };
  return langMap[ext] || 'plaintext';
}

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

interface FileTab {
  name: string;
  content: string;
  dirty: boolean;
}

type MobilePanel = 'chat' | 'terminal' | 'editor' | 'preview';

// Glass panel styling
const glassPanel = {
  background: 'rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: '20px',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
  overflow: 'hidden',
};

const glassPanelHeader = {
  background: 'rgba(255, 255, 255, 0.05)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  px: 2,
  py: 1.5,
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  cursor: 'grab',
  '&:active': { cursor: 'grabbing' },
};

// Gradient button styling
const glassButton = {
  background: 'rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '12px',
  color: 'white',
  px: 2,
  py: 1,
  fontSize: '0.875rem',
  fontWeight: 500,
  transition: 'all 0.2s ease',
  '&:hover': {
    background: 'rgba(255, 255, 255, 0.2)',
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
  },
  '&:active': {
    transform: 'translateY(0)',
  },
  '&:disabled': {
    opacity: 0.4,
  },
};

const primaryGlassButton = {
  ...glassButton,
  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.8), rgba(168, 85, 247, 0.8))',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  '&:hover': {
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(168, 85, 247, 0.9))',
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)',
  },
};

export function Workspace() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Store
  const {
    messages,
    isStreaming,
    currentProvider,
    sendMessage,
    googleAccessToken,
    driveProjectFolderId,
    projectConfig,
    setGoogleToken,
    setDriveFolder,
    setProjectConfig,
  } = useAppStore();

  // Local state
  const [input, setInput] = useState('');
  const [container, setContainer] = useState<WebContainer | null>(null);
  const [containerReady, setContainerReady] = useState(false);
  const [openTabs, setOpenTabs] = useState<FileTab[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [driveFileIds, setDriveFileIds] = useState<Record<string, string>>({});

  // Panel sizes (percentage based for resizing)
  const [chatWidth, setChatWidth] = useState(40);
  const [terminalHeight, setTerminalHeight] = useState(50);
  const [showPreview, setShowPreview] = useState(false);
  const [showTerminal, setShowTerminal] = useState(true);
  const [showEditor, setShowEditor] = useState(true);

  // Mobile-specific state
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('chat');
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [customCommand, setCustomCommand] = useState('');

  // Modal state for project wizard/picker
  const [showWizard, setShowWizard] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // Refs
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const shellInputRef = useRef<WritableStreamDefaultWriter | null>(null);
  const driveClientRef = useRef<GoogleDriveClient | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resizingRef = useRef<'chat' | 'terminal' | null>(null);

  // Initialize Google Drive client
  useEffect(() => {
    if (googleAccessToken) {
      driveClientRef.current = new GoogleDriveClient(googleAccessToken);
    }
  }, [googleAccessToken]);

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
          setShowPreview(true);
        });

        // Start with empty filesystem - files load from Google Drive when project is connected
        if (terminalInstanceRef.current) {
          await startShell(wc);
        }
      } catch (err) {
        console.error('WebContainer boot failed:', err);
      }
    }

    boot();
    return () => { mounted = false; };
  }, []);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || terminalInstanceRef.current) return;

    const terminal = new Terminal({
      theme: {
        background: 'rgba(0, 0, 0, 0)',
        foreground: '#ffffff',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selectionBackground: 'rgba(139, 92, 246, 0.4)',
      },
      fontSize: isSmallMobile ? 11 : 13,
      fontFamily: '"SF Mono", Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);
    fitAddon.fit();

    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    terminal.writeln('\x1b[38;2;139;92;246m✦ Studiora Workspace\x1b[0m');
    terminal.writeln('\x1b[90mBooting container...\x1b[0m');

    if (container) {
      startShell(container);
    }

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
      terminalInstanceRef.current = null;
    };
  }, [container, isSmallMobile]);

  // Refit terminal when panel changes
  useEffect(() => {
    if (fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current?.fit(), 100);
    }
  }, [mobilePanel, showTerminal, terminalHeight]);

  const startShell = async (wc: WebContainer) => {
    const terminal = terminalInstanceRef.current;
    if (!terminal) return;

    terminal.writeln('\x1b[32m✓ Ready\x1b[0m\n');

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

  const writeFile = useCallback(async (path: string, content: string) => {
    if (!container) return;

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

    if (driveClientRef.current && driveProjectFolderId) {
      try {
        const existingFileId = driveFileIds[path];
        if (existingFileId) {
          await driveClientRef.current.updateFile(existingFileId, content);
        } else {
          const newFile = await driveClientRef.current.createFile(path, content, driveProjectFolderId);
          setDriveFileIds(prev => ({ ...prev, [path]: newFile.id }));
        }
        terminalInstanceRef.current?.writeln(`\x1b[32m✓ ${path}\x1b[0m`);
      } catch (err) {
        console.error('Failed to sync to Drive:', err);
        const errorMessage = String(err);
        if (errorMessage.includes('401')) {
          terminalInstanceRef.current?.writeln(`\x1b[31m✗ ${path} (token expired)\x1b[0m`);
          setGoogleToken('');
        } else {
          terminalInstanceRef.current?.writeln(`\x1b[33m⚠ ${path} (sync failed)\x1b[0m`);
        }
      }
    } else {
      terminalInstanceRef.current?.writeln(`\x1b[32m✓ ${path}\x1b[0m`);
    }

    setOpenTabs(prev => prev.map(tab =>
      tab.name === path ? { ...tab, content, dirty: false } : tab
    ));
  }, [container, driveProjectFolderId, driveFileIds, setGoogleToken]);

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

  const loadFromGoogleDrive = useCallback(async () => {
    if (!container || !driveClientRef.current || !driveProjectFolderId) {
      terminalInstanceRef.current?.writeln('\x1b[33m⚠ No project connected\x1b[0m');
      return;
    }

    setSyncStatus('syncing');
    terminalInstanceRef.current?.writeln('\x1b[36m↻ Syncing from Drive...\x1b[0m');

    try {
      const files = await driveClientRef.current.listFiles(driveProjectFolderId);
      const fileIdMap: Record<string, string> = {};
      let loadedCount = 0;

      for (const file of files) {
        if (file.mimeType === 'application/vnd.google-apps.folder') continue;
        if (file.name.startsWith('.studiora')) continue;

        try {
          const content = await driveClientRef.current.getFileContent(file.id);
          await container.fs.writeFile(file.name, content);
          fileIdMap[file.name] = file.id;
          loadedCount++;
        } catch (err) {
          console.error(`Failed to load ${file.name}:`, err);
        }
      }

      setDriveFileIds(fileIdMap);
      setSyncStatus('synced');
      terminalInstanceRef.current?.writeln(`\x1b[32m✓ Loaded ${loadedCount} files\x1b[0m`);

      const fileList = await listFiles();
      setProjectFiles(fileList);
    } catch (err) {
      console.error('Failed to load from Drive:', err);
      setSyncStatus('error');

      const errorMessage = String(err);
      if (errorMessage.includes('401')) {
        terminalInstanceRef.current?.writeln('\x1b[31m✗ Token expired\x1b[0m');
        setGoogleToken('');
      } else {
        terminalInstanceRef.current?.writeln('\x1b[31m✗ Sync failed\x1b[0m');
      }
    }
  }, [container, driveProjectFolderId, listFiles, setGoogleToken]);

  useEffect(() => {
    if (containerReady && driveProjectFolderId && syncStatus === 'idle') {
      loadFromGoogleDrive();
    }
  }, [containerReady, driveProjectFolderId, syncStatus, loadFromGoogleDrive]);

  const parseAndWriteCodeBlocks = useCallback(async (response: string) => {
    const codeBlockRegex = /```(?:(\w+):)?([^\n`]+)?\n([\s\S]*?)```/g;
    let match;
    const writtenFiles: string[] = [];

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const [, , filename, code] = match;
      let targetFile = filename?.trim();

      if (targetFile && (targetFile.includes('/') || targetFile.includes('.'))) {
        targetFile = targetFile.replace(/^\/+/, '');
        if (code.trim()) {
          await writeFile(targetFile, code.trim());
          writtenFiles.push(targetFile);
        }
      }
    }

    return writtenFiles;
  }, [writeFile]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput('');

    let context = '';

    if (containerReady) {
      const fileList = await listFiles();
      if (fileList.length > 0) {
        context += '\n\nCurrent project files:\n';
        for (const file of fileList.slice(0, 20)) {
          const content = await readFile(file);
          if (content.length < 5000) {
            context += `\n--- ${file} ---\n${content}\n`;
          } else {
            context += `\n--- ${file} --- (truncated, ${content.length} chars)\n${content.slice(0, 2000)}...\n`;
          }
        }
      }
    }

    const enhancedMessage = userMessage + context + `

IMPORTANT: When you write code, use this format so I can save it:
\`\`\`language:filename.ext
code here
\`\`\`

For example:
\`\`\`javascript:src/index.js
console.log('hello');
\`\`\`

The code will be automatically written to the file system.`;

    try {
      await sendMessage(enhancedMessage);

      const latestMessage = useAppStore.getState().messages.slice(-1)[0];
      if (latestMessage?.role === 'assistant') {
        const written = await parseAndWriteCodeBlocks(latestMessage.content);
        if (written.length > 0) {
          terminalInstanceRef.current?.writeln(`\x1b[36m✦ AI wrote ${written.length} file(s)\x1b[0m`);
        }
      }
    } catch (err) {
      console.error('Send failed:', err);
    }
  };

  const runCommand = async (cmd: string) => {
    if (!shellInputRef.current) return;
    await shellInputRef.current.write(cmd + '\n');
    if (isMobile) {
      setMobilePanel('terminal');
      setQuickActionsOpen(false);
    }
  };

  const openFileInEditor = useCallback(async (path: string) => {
    const existing = openTabs.find(t => t.name === path);
    if (existing) {
      setActiveTab(openTabs.indexOf(existing));
      setShowEditor(true);
      if (isMobile) setMobilePanel('editor');
      return;
    }

    const content = await readFile(path);
    const newTab: FileTab = { name: path, content, dirty: false };
    setOpenTabs(prev => [...prev, newTab]);
    setActiveTab(openTabs.length);
    setShowEditor(true);
    if (isMobile) setMobilePanel('editor');
  }, [openTabs, readFile, isMobile]);

  const refreshFiles = useCallback(async () => {
    const files = await listFiles();
    setProjectFiles(files);
  }, [listFiles]);

  const saveCurrentTab = async () => {
    const tab = openTabs[activeTab];
    if (!tab) return;
    await writeFile(tab.name, tab.content);
  };

  const closeTab = (index: number) => {
    setOpenTabs(prev => prev.filter((_, i) => i !== index));
    if (activeTab >= index && activeTab > 0) {
      setActiveTab(activeTab - 1);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Handle resize
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (resizingRef.current === 'chat') {
      const newWidth = (e.clientX / window.innerWidth) * 100;
      setChatWidth(Math.min(Math.max(newWidth, 25), 60));
    } else if (resizingRef.current === 'terminal') {
      const containerTop = document.querySelector('.right-panels')?.getBoundingClientRect().top || 0;
      const containerHeight = window.innerHeight - containerTop;
      const newHeight = ((e.clientY - containerTop) / containerHeight) * 100;
      setTerminalHeight(Math.min(Math.max(newHeight, 20), 80));
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const startResize = (type: 'chat' | 'terminal') => {
    resizingRef.current = type;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // ============ RENDER HELPERS ============

  const renderChatPanel = () => (
    <Box sx={{
      ...glassPanel,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      m: isMobile ? 0 : 2,
      mr: isMobile ? 0 : 1,
    }}>
      {/* Header */}
      <Box sx={glassPanelHeader}>
        <DragIndicator sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }} />
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontWeight: 600, color: 'white', fontSize: '0.95rem' }}>
            AI Assistant
          </Typography>
          <Chip
            label={currentProvider}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.7rem',
              bgcolor: 'rgba(139, 92, 246, 0.3)',
              color: 'white',
              border: '1px solid rgba(139, 92, 246, 0.5)',
            }}
          />
        </Box>
        {!containerReady && <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.5)' }} />}
        {syncStatus === 'synced' && (
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10b981' }} />
        )}
      </Box>

      {/* Project status */}
      {!driveProjectFolderId && (
        <Box sx={{
          mx: 2,
          mt: 1.5,
          p: 2,
          borderRadius: '16px',
          bgcolor: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
        }}>
          <Typography sx={{ fontSize: '0.9rem', color: 'white', fontWeight: 500, mb: 1 }}>
            No project open
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', mb: 2 }}>
            Open an existing project or create a new one to get started.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Box
              component="button"
              onClick={() => setShowWizard(true)}
              sx={{
                ...primaryGlassButton,
                py: 1,
                px: 2,
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              <AutoAwesome sx={{ fontSize: 16 }} />
              New Project
            </Box>
            <Box
              component="button"
              onClick={() => setShowPicker(true)}
              sx={{
                ...glassButton,
                py: 1,
                px: 2,
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              <FolderOpen sx={{ fontSize: 16 }} />
              Open Project
            </Box>
          </Box>
        </Box>
      )}
      {driveProjectFolderId && projectConfig && (
        <Box sx={{
          mx: 2,
          mt: 1.5,
          p: 1.5,
          borderRadius: '12px',
          bgcolor: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}>
          <Folder sx={{ fontSize: 18, color: '#10b981' }} />
          <Typography sx={{ fontSize: '0.85rem', color: 'white', fontWeight: 500 }}>
            {projectConfig.name}
          </Typography>
        </Box>
      )}

      {/* Messages */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {messages.length === 0 ? (
          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Box sx={{
              width: 64,
              height: 64,
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(168, 85, 247, 0.3))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
            }}>
              <ChatIcon sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem' }}>
              Ask me to create files, write code, or build your project.
            </Typography>
          </Box>
        ) : (
          messages.map((msg, i) => (
            <Box
              key={i}
              sx={{
                mb: 2,
                p: 2,
                borderRadius: '16px',
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(168, 85, 247, 0.4))'
                  : 'rgba(255, 255, 255, 0.08)',
                border: '1px solid',
                borderColor: msg.role === 'user'
                  ? 'rgba(139, 92, 246, 0.4)'
                  : 'rgba(255, 255, 255, 0.1)',
                maxWidth: '90%',
                ml: msg.role === 'user' ? 'auto' : 0,
              }}
            >
              <Typography
                sx={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: msg.content.includes('```') ? '"SF Mono", monospace' : 'inherit',
                  fontSize: '0.875rem',
                  wordBreak: 'break-word',
                  color: 'white',
                }}
              >
                {msg.content}
              </Typography>
            </Box>
          ))
        )}
        {isStreaming && (
          <Box sx={{ display: 'flex', gap: 1, color: 'rgba(255,255,255,0.6)' }}>
            <CircularProgress size={16} sx={{ color: 'rgba(139, 92, 246, 0.8)' }} />
            <Typography sx={{ fontSize: '0.875rem' }}>Thinking...</Typography>
          </Box>
        )}
        <div ref={chatEndRef} />
      </Box>

      {/* Input */}
      <Box sx={{
        p: 2,
        borderTop: '1px solid rgba(255,255,255,0.08)',
        pb: isMobile ? 9 : 2,
      }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Ask me to write code..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isStreaming}
            multiline
            maxRows={4}
            inputRef={inputRef}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255,255,255,0.05)',
                borderRadius: '14px',
                fontSize: '16px',
                color: 'white',
                '& fieldset': {
                  borderColor: 'rgba(255,255,255,0.15)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(255,255,255,0.25)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'rgba(139, 92, 246, 0.6)',
                },
              },
              '& .MuiInputBase-input::placeholder': {
                color: 'rgba(255,255,255,0.4)',
              },
            }}
          />
          <IconButton
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            sx={{
              ...primaryGlassButton,
              minWidth: 48,
              minHeight: 48,
              borderRadius: '14px',
            }}
          >
            <Send />
          </IconButton>
        </Box>

        {/* Quick actions - desktop only */}
        {!isMobile && (
          <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
            {['npm install', 'npm run dev', 'ls -la'].map((cmd) => (
              <Box
                key={cmd}
                component="button"
                onClick={() => runCommand(cmd)}
                disabled={!containerReady}
                sx={{
                  ...glassButton,
                  border: 'none',
                  cursor: containerReady ? 'pointer' : 'not-allowed',
                  fontSize: '0.8rem',
                  py: 0.75,
                  px: 1.5,
                }}
              >
                {cmd}
              </Box>
            ))}
            <Box
              component="button"
              onClick={refreshFiles}
              disabled={!containerReady}
              sx={{
                ...glassButton,
                border: 'none',
                cursor: containerReady ? 'pointer' : 'not-allowed',
                fontSize: '0.8rem',
                py: 0.75,
                px: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              <Refresh sx={{ fontSize: 16 }} /> Files
            </Box>
            <Box
              component="button"
              onClick={loadFromGoogleDrive}
              disabled={!containerReady || !driveProjectFolderId || syncStatus === 'syncing'}
              sx={{
                ...glassButton,
                border: 'none',
                cursor: containerReady && driveProjectFolderId ? 'pointer' : 'not-allowed',
                fontSize: '0.8rem',
                py: 0.75,
                px: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                bgcolor: syncStatus === 'synced' ? 'rgba(16, 185, 129, 0.2)' : undefined,
              }}
            >
              <CloudSync sx={{ fontSize: 16 }} />
              {syncStatus === 'syncing' ? 'Syncing...' : 'Sync'}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );

  const renderTerminalPanel = () => (
    <Box sx={{
      ...glassPanel,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      m: isMobile ? 0 : 0,
    }}>
      <Box sx={glassPanelHeader}>
        <DragIndicator sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }} />
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ff5f56' }} />
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ffbd2e' }} />
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#27ca40' }} />
        </Box>
        <Typography sx={{ ml: 1, fontWeight: 500, color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
          Terminal
        </Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={() => setShowTerminal(!showTerminal)} sx={{ color: 'rgba(255,255,255,0.5)' }}>
          {showTerminal ? <Remove sx={{ fontSize: 18 }} /> : <Add sx={{ fontSize: 18 }} />}
        </IconButton>
      </Box>
      <Box
        ref={terminalRef}
        sx={{
          flex: 1,
          minHeight: 100,
          overflow: 'hidden',
          bgcolor: 'rgba(0, 0, 0, 0.4)',
          '& .xterm': {
            height: '100%',
            padding: '12px',
          },
          '& .xterm-viewport': {
            overflow: 'auto !important',
          },
        }}
      />
    </Box>
  );

  const renderEditorPanel = () => (
    <Box sx={{
      ...glassPanel,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      m: isMobile ? 0 : 0,
    }}>
      <Box sx={glassPanelHeader}>
        <DragIndicator sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }} />
        <Code sx={{ color: 'rgba(139, 92, 246, 0.8)', fontSize: 18 }} />
        <Typography sx={{ fontWeight: 500, color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
          Editor
        </Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={() => setShowEditor(!showEditor)} sx={{ color: 'rgba(255,255,255,0.5)' }}>
          {showEditor ? <Remove sx={{ fontSize: 18 }} /> : <Add sx={{ fontSize: 18 }} />}
        </IconButton>
      </Box>

      {openTabs.length > 0 ? (
        <>
          <Box sx={{
            display: 'flex',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            overflow: 'auto',
            minHeight: 40,
          }}>
            {openTabs.map((tab, i) => (
              <Box
                key={tab.name}
                onClick={() => setActiveTab(i)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 1,
                  cursor: 'pointer',
                  bgcolor: activeTab === i ? 'rgba(255,255,255,0.1)' : 'transparent',
                  borderBottom: activeTab === i ? '2px solid rgba(139, 92, 246, 0.8)' : '2px solid transparent',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.08)',
                  },
                }}
              >
                <Typography sx={{ fontSize: '0.8rem', color: 'white', whiteSpace: 'nowrap' }}>
                  {tab.name.split('/').pop()}{tab.dirty ? ' •' : ''}
                </Typography>
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); closeTab(i); }}
                  sx={{ p: 0.25, color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}
                >
                  <Close sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            ))}
            <IconButton onClick={saveCurrentTab} sx={{ ml: 'auto', mr: 1, color: 'rgba(255,255,255,0.5)' }}>
              <Save sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <Editor
              height="100%"
              language={getLanguageFromPath(openTabs[activeTab]?.name || '')}
              value={openTabs[activeTab]?.content || ''}
              onChange={(value) => {
                setOpenTabs(prev => prev.map((tab, i) =>
                  i === activeTab ? { ...tab, content: value || '', dirty: true } : tab
                ));
              }}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: isMobile ? 12 : 14,
                lineNumbers: 'on',
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                padding: { top: 8 },
              }}
              onMount={(editor) => {
                editor.addCommand(2048 | 49, () => saveCurrentTab());
              }}
            />
          </Box>
        </>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2, overflow: 'auto' }}>
          {projectFiles.length > 0 ? (
            <>
              <Typography sx={{ mb: 1.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', fontWeight: 500 }}>
                PROJECT FILES
              </Typography>
              {projectFiles.map((file) => (
                <Box
                  key={file}
                  component="button"
                  onClick={() => openFileInEditor(file)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1.5,
                    mb: 0.5,
                    borderRadius: '10px',
                    bgcolor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer',
                    color: 'white',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.08)',
                      borderColor: 'rgba(139, 92, 246, 0.4)',
                    },
                  }}
                >
                  <Code sx={{ fontSize: 16, color: 'rgba(139, 92, 246, 0.7)' }} />
                  {file}
                </Box>
              ))}
            </>
          ) : (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: 3 }}>
              {driveProjectFolderId ? (
                <>
                  <Folder sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)', mb: 2 }} />
                  <Typography sx={{ color: 'rgba(255,255,255,0.6)', mb: 1 }}>
                    Project folder is empty
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                    Ask AI to create files or run commands in the terminal
                  </Typography>
                </>
              ) : (
                <>
                  <Folder sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)', mb: 2 }} />
                  <Typography sx={{ color: 'rgba(255,255,255,0.6)', mb: 1 }}>
                    No project open
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', mb: 2 }}>
                    Open or create a project to see files here
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Box
                      component="button"
                      onClick={() => setShowWizard(true)}
                      sx={{
                        ...primaryGlassButton,
                        py: 1,
                        px: 2,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      <AutoAwesome sx={{ fontSize: 16 }} />
                      New
                    </Box>
                    <Box
                      component="button"
                      onClick={() => setShowPicker(true)}
                      sx={{
                        ...glassButton,
                        py: 1,
                        px: 2,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      <FolderOpen sx={{ fontSize: 16 }} />
                      Open
                    </Box>
                  </Box>
                </>
              )}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );

  const renderPreviewPanel = () => (
    <Box sx={{
      ...glassPanel,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      m: isMobile ? 0 : 0,
    }}>
      <Box sx={glassPanelHeader}>
        <DragIndicator sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }} />
        <PreviewIcon sx={{ color: 'rgba(16, 185, 129, 0.8)', fontSize: 18 }} />
        <Typography sx={{ fontWeight: 500, color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
          Preview
        </Typography>
        {serverUrl && (
          <Chip
            label="Live"
            size="small"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              bgcolor: 'rgba(16, 185, 129, 0.3)',
              color: '#10b981',
              ml: 1,
            }}
          />
        )}
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={() => setShowPreview(!showPreview)} sx={{ color: 'rgba(255,255,255,0.5)' }}>
          {showPreview ? <Remove sx={{ fontSize: 18 }} /> : <Add sx={{ fontSize: 18 }} />}
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, overflow: 'hidden', bgcolor: '#fff', borderRadius: '0 0 20px 20px' }}>
        {serverUrl ? (
          <iframe
            src={serverUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Preview"
          />
        ) : (
          <Box sx={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(0,0,0,0.4)',
          }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>
              Run `npm run dev` to start
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );

  // Handle project picker selection
  const handleProjectSelect = (projectId: string, config: { name: string; framework?: string } | undefined) => {
    setDriveFolder(projectId);
    if (config) {
      setProjectConfig(config as Parameters<typeof setProjectConfig>[0]);
    }
    setShowPicker(false);
    setSyncStatus('idle'); // Will trigger auto-load
  };

  // ============ WIZARD/PICKER OVERLAYS ============
  if (showWizard) {
    return (
      <ProjectWizard
        onComplete={() => {
          setShowWizard(false);
          setSyncStatus('idle'); // Will trigger auto-load
        }}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  if (showPicker) {
    return (
      <ProjectPicker
        onSelect={handleProjectSelect}
        onCancel={() => setShowPicker(false)}
      />
    );
  }

  // ============ MOBILE LAYOUT ============
  if (isMobile) {
    return (
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 25%, #4c1d95 50%, #581c87 75%, #701a75 100%)',
      }}>
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          {mobilePanel === 'chat' && renderChatPanel()}
          {mobilePanel === 'terminal' && renderTerminalPanel()}
          {mobilePanel === 'editor' && renderEditorPanel()}
          {mobilePanel === 'preview' && renderPreviewPanel()}
        </Box>

        {/* Quick actions FAB */}
        <Fab
          size="small"
          onClick={() => setQuickActionsOpen(true)}
          sx={{
            position: 'fixed',
            bottom: 80,
            right: 16,
            zIndex: 1000,
            ...primaryGlassButton,
            borderRadius: '50%',
          }}
        >
          <MoreVert />
        </Fab>

        {/* Quick actions drawer */}
        <Drawer
          anchor="bottom"
          open={quickActionsOpen}
          onClose={() => setQuickActionsOpen(false)}
          PaperProps={{
            sx: {
              background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.95), rgba(49, 46, 129, 0.95))',
              backdropFilter: 'blur(20px)',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '60vh',
            }
          }}
        >
          <Box sx={{ p: 2.5, pb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ fontWeight: 600, color: 'white', fontSize: '1.1rem' }}>Quick Actions</Typography>
              <IconButton onClick={() => setQuickActionsOpen(false)} sx={{ color: 'rgba(255,255,255,0.6)' }}>
                <Close />
              </IconButton>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                size="small"
                placeholder="Custom command..."
                value={customCommand}
                onChange={(e) => setCustomCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customCommand.trim()) {
                    runCommand(customCommand.trim());
                    setCustomCommand('');
                  }
                }}
                disabled={!containerReady}
                sx={{
                  flex: 1,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                    fontSize: '16px',
                    color: 'white',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                  },
                }}
              />
              <Box
                component="button"
                onClick={() => {
                  if (customCommand.trim()) {
                    runCommand(customCommand.trim());
                    setCustomCommand('');
                  }
                }}
                disabled={!containerReady || !customCommand.trim()}
                sx={primaryGlassButton}
              >
                Run
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {['npm install', 'npm run dev', 'npx expo start -c', 'npm run build'].map((cmd) => (
                <Box
                  key={cmd}
                  component="button"
                  onClick={() => runCommand(cmd)}
                  disabled={!containerReady}
                  sx={{
                    ...glassButton,
                    textAlign: 'left',
                    py: 1.5,
                  }}
                >
                  {cmd}
                </Box>
              ))}
              <Box
                component="button"
                onClick={() => { refreshFiles(); setQuickActionsOpen(false); }}
                disabled={!containerReady}
                sx={{
                  ...glassButton,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 1.5,
                }}
              >
                <Refresh sx={{ fontSize: 18 }} /> Refresh Files
              </Box>
              <Box
                component="button"
                onClick={() => { loadFromGoogleDrive(); setQuickActionsOpen(false); }}
                disabled={!containerReady || !driveProjectFolderId || syncStatus === 'syncing'}
                sx={{
                  ...glassButton,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 1.5,
                  bgcolor: syncStatus === 'synced' ? 'rgba(16, 185, 129, 0.2)' : undefined,
                }}
              >
                <CloudSync sx={{ fontSize: 18 }} />
                {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Drive'}
              </Box>
            </Box>
          </Box>
        </Drawer>

        {/* Bottom navigation */}
        <BottomNavigation
          value={mobilePanel}
          onChange={(_, newValue) => setMobilePanel(newValue)}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'rgba(30, 27, 75, 0.9)',
            backdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            height: 70,
            zIndex: 1100,
            '& .MuiBottomNavigationAction-root': {
              minWidth: 60,
              color: 'rgba(255,255,255,0.5)',
              '&.Mui-selected': {
                color: '#a78bfa',
              },
            },
          }}
        >
          <BottomNavigationAction label="Chat" value="chat" icon={<ChatIcon />} />
          <BottomNavigationAction label="Terminal" value="terminal" icon={<TerminalIcon />} />
          <BottomNavigationAction label="Editor" value="editor" icon={<Code />} />
          <BottomNavigationAction label="Preview" value="preview" icon={<PreviewIcon />} disabled={!serverUrl} />
        </BottomNavigation>
      </Box>
    );
  }

  // ============ DESKTOP LAYOUT ============
  return (
    <Box sx={{
      display: 'flex',
      height: '100%',
      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 25%, #4c1d95 50%, #581c87 75%, #701a75 100%)',
      overflow: 'hidden',
    }}>
      {/* Left: AI Chat */}
      <Box
        sx={{
          width: `${chatWidth}%`,
          minWidth: 350,
          maxWidth: 700,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {renderChatPanel()}
      </Box>

      {/* Resize handle - chat */}
      <Box
        onMouseDown={() => startResize('chat')}
        sx={{
          width: 8,
          cursor: 'col-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          '&:hover': {
            '& > div': {
              bgcolor: 'rgba(139, 92, 246, 0.6)',
            },
          },
        }}
      >
        <Box sx={{
          width: 4,
          height: 40,
          borderRadius: 2,
          bgcolor: 'rgba(255,255,255,0.2)',
          transition: 'background-color 0.2s',
        }} />
      </Box>

      {/* Right: Terminal + Editor + Preview */}
      <Box className="right-panels" sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        p: 2,
        pl: 1,
        minWidth: 0,
      }}>
        {/* Top row: Terminal */}
        <Box sx={{ height: showPreview ? `${terminalHeight}%` : '50%', display: 'flex', gap: 1 }}>
          <Box sx={{ flex: 1 }}>
            {renderTerminalPanel()}
          </Box>
          <Box sx={{ flex: 1 }}>
            {renderEditorPanel()}
          </Box>
        </Box>

        {/* Resize handle - terminal */}
        {showPreview && (
          <Box
            onMouseDown={() => startResize('terminal')}
            sx={{
              height: 8,
              cursor: 'row-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              '&:hover': {
                '& > div': {
                  bgcolor: 'rgba(139, 92, 246, 0.6)',
                },
              },
            }}
          >
            <Box sx={{
              width: 40,
              height: 4,
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.2)',
              transition: 'background-color 0.2s',
            }} />
          </Box>
        )}

        {/* Bottom: Preview */}
        {showPreview && (
          <Box sx={{ flex: 1, minHeight: 200 }}>
            {renderPreviewPanel()}
          </Box>
        )}
      </Box>
    </Box>
  );
}
