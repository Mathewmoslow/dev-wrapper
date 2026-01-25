import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Drawer,
  TextField,
  Button,
  Tooltip,
  CircularProgress,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Close,
  CloudSync,
  SmartToy,
  Send,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  OpenInNew,
  Add,
  KeyboardArrowDown,
  Folder,
} from '@mui/icons-material';
import { WebContainer } from '@webcontainer/api';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import Editor from '@monaco-editor/react';
import { useAppStore } from '../../stores/app-store';
import { GoogleDriveClient } from '../../lib/google-drive';
import { FileTree } from './FileTree';

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

function getLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    json: 'json', css: 'css', html: 'html', md: 'markdown', py: 'python',
    yaml: 'yaml', yml: 'yaml', sh: 'shell', bash: 'shell',
  };
  return map[ext] || 'plaintext';
}

interface FileTab {
  path: string;
  content: string;
  dirty: boolean;
}

interface DriveProject {
  id: string;
  name: string;
}

export function IDE() {
  const {
    messages,
    isStreaming,
    sendMessage,
    currentProvider,
    googleAccessToken,
    driveProjectFolderId,
    setDriveFolder,
    setGoogleToken,
  } = useAppStore();

  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth] = useState(220);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [terminalHeight] = useState(180);
  const [showPreview, setShowPreview] = useState(false);

  // Project State
  const [projects, setProjects] = useState<DriveProject[]>([]);
  const [projectMenuAnchor, setProjectMenuAnchor] = useState<null | HTMLElement>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // File State
  const [files, setFiles] = useState<string[]>([]);
  const [openTabs, setOpenTabs] = useState<FileTab[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [driveFileIds, setDriveFileIds] = useState<Record<string, string>>({});

  // WebContainer State
  const [container, setContainer] = useState<WebContainer | null>(null);
  const [containerReady, setContainerReady] = useState(false);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  // AI State
  const [aiInput, setAiInput] = useState('');

  // Refs
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const shellInputRef = useRef<WritableStreamDefaultWriter | null>(null);
  const driveClientRef = useRef<GoogleDriveClient | null>(null);

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

        await wc.mount({
          'package.json': {
            file: {
              contents: JSON.stringify({ name: 'project', type: 'module', scripts: { dev: 'echo "Run npm install first"' } }, null, 2)
            }
          }
        });

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
      theme: { background: '#1e1e1e', foreground: '#d4d4d4', cursor: '#fff' },
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);
    fitAddon.fit();

    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    terminal.writeln('\x1b[36mStudiora IDE\x1b[0m');

    if (container) {
      startShell(container);
    }

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [container]);

  // Auto-load from Google Drive
  useEffect(() => {
    if (containerReady && driveProjectFolderId && syncStatus === 'idle') {
      loadFromGoogleDrive();
    }
  }, [containerReady, driveProjectFolderId]);

  const startShell = async (wc: WebContainer) => {
    const terminal = terminalInstanceRef.current;
    if (!terminal) return;

    terminal.writeln('\x1b[32mReady\x1b[0m\n');

    const shellProcess = await wc.spawn('jsh', {
      terminal: { cols: terminal.cols, rows: terminal.rows },
    });

    shellProcess.output.pipeTo(
      new WritableStream({ write(data) { terminal.write(data); } })
    );

    const input = shellProcess.input.getWriter();
    shellInputRef.current = input;

    terminal.onData((data) => input.write(data));
    terminal.onResize(({ cols, rows }) => shellProcess.resize({ cols, rows }));
  };

  // Load projects from Drive
  const loadProjects = useCallback(async () => {
    if (!driveClientRef.current) return;

    setLoadingProjects(true);
    try {
      // Search for folders with .studiora config
      const response = await driveClientRef.current.searchFolders();
      const projectList: DriveProject[] = [];

      for (const folder of response) {
        // Check if folder has .studiora subfolder (indicates it's a project)
        try {
          const files = await driveClientRef.current.listFiles(folder.id);
          const hasConfig = files.some(f => f.name.startsWith('.studiora'));
          if (hasConfig || files.length > 0) {
            projectList.push({ id: folder.id, name: folder.name });
          }
        } catch {
          // Skip folders we can't access
        }
      }

      setProjects(projectList);
    } catch (err) {
      console.error('Failed to load projects:', err);
      if (String(err).includes('401')) {
        setGoogleToken('');
      }
    } finally {
      setLoadingProjects(false);
    }
  }, [setGoogleToken]);

  // Switch project
  const switchProject = useCallback(async (projectId: string) => {
    setProjectMenuAnchor(null);
    setDriveFolder(projectId);
    setSyncStatus('idle');
    setFiles([]);
    setOpenTabs([]);
    setDriveFileIds({});
    setServerUrl(null);

    // Clear WebContainer files
    if (container) {
      try {
        const entries = await container.fs.readdir('/');
        for (const entry of entries) {
          if (entry !== '.' && entry !== '..') {
            await container.spawn('rm', ['-rf', entry]);
          }
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }, [container, setDriveFolder]);

  // File operations
  const writeFile = useCallback(async (path: string, content: string) => {
    if (!container) return;

    const dir = path.split('/').slice(0, -1).join('/');
    if (dir) {
      const proc = await container.spawn('mkdir', ['-p', dir]);
      await proc.exit;
    }

    await container.fs.writeFile(path, content);

    if (driveClientRef.current && driveProjectFolderId) {
      try {
        const existingId = driveFileIds[path];
        if (existingId) {
          await driveClientRef.current.updateFile(existingId, content);
        } else {
          const newFile = await driveClientRef.current.createFile(path, content, driveProjectFolderId);
          setDriveFileIds(prev => ({ ...prev, [path]: newFile.id }));
        }
        terminalInstanceRef.current?.writeln(`\x1b[32m✓ Saved: ${path}\x1b[0m`);
      } catch (err) {
        console.error('Drive sync failed:', err);
        terminalInstanceRef.current?.writeln(`\x1b[33m⚠ Saved locally: ${path}\x1b[0m`);
      }
    }
  }, [container, driveProjectFolderId, driveFileIds]);

  const readFile = useCallback(async (path: string): Promise<string> => {
    if (!container) return '';
    try {
      return await container.fs.readFile(path, 'utf-8');
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
            fileList.push(...await listFiles(path));
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

  const refreshFiles = useCallback(async () => {
    const fileList = await listFiles();
    setFiles(fileList);
  }, [listFiles]);

  const loadFromGoogleDrive = useCallback(async () => {
    if (!driveClientRef.current || !driveProjectFolderId || !container) return;

    setSyncStatus('syncing');
    terminalInstanceRef.current?.writeln('\x1b[36mLoading from Google Drive...\x1b[0m');

    try {
      const driveFiles = await driveClientRef.current.listFiles(driveProjectFolderId);
      const idMap: Record<string, string> = {};
      let count = 0;

      for (const file of driveFiles) {
        if (file.mimeType === 'application/vnd.google-apps.folder') continue;
        if (file.name.startsWith('.studiora')) continue;

        try {
          const content = await driveClientRef.current.getFileContent(file.id);
          const dir = file.name.split('/').slice(0, -1).join('/');
          if (dir) {
            const proc = await container.spawn('mkdir', ['-p', dir]);
            await proc.exit;
          }
          await container.fs.writeFile(file.name, content);
          idMap[file.name] = file.id;
          count++;
        } catch (err) {
          console.error(`Failed to load ${file.name}:`, err);
        }
      }

      setDriveFileIds(idMap);
      setSyncStatus('synced');
      terminalInstanceRef.current?.writeln(`\x1b[32m✓ Loaded ${count} files\x1b[0m`);
      refreshFiles();
    } catch (err) {
      console.error('Drive sync failed:', err);
      setSyncStatus('error');
      terminalInstanceRef.current?.writeln('\x1b[31m✗ Sync failed\x1b[0m');
      if (String(err).includes('401')) {
        setGoogleToken('');
      }
    }
  }, [container, driveProjectFolderId, refreshFiles, setGoogleToken]);

  const openFile = useCallback(async (path: string) => {
    const existingIndex = openTabs.findIndex(t => t.path === path);
    if (existingIndex !== -1) {
      setActiveTabIndex(existingIndex);
      return;
    }
    const content = await readFile(path);
    setOpenTabs(prev => [...prev, { path, content, dirty: false }]);
    setActiveTabIndex(openTabs.length);
  }, [openTabs, readFile]);

  const closeTab = useCallback((index: number) => {
    setOpenTabs(prev => prev.filter((_, i) => i !== index));
    if (activeTabIndex >= index && activeTabIndex > 0) {
      setActiveTabIndex(activeTabIndex - 1);
    }
  }, [activeTabIndex]);

  const saveCurrentFile = useCallback(async () => {
    const tab = openTabs[activeTabIndex];
    if (!tab) return;
    await writeFile(tab.path, tab.content);
    setOpenTabs(prev => prev.map((t, i) =>
      i === activeTabIndex ? { ...t, dirty: false } : t
    ));
  }, [activeTabIndex, openTabs, writeFile]);

  const runCommand = useCallback((cmd: string) => {
    shellInputRef.current?.write(cmd + '\n');
  }, []);

  const createFile = useCallback(async (name: string) => {
    await writeFile(name, '');
    await refreshFiles();
    openFile(name);
  }, [writeFile, refreshFiles, openFile]);

  const createFolder = useCallback(async (name: string) => {
    if (!container) return;
    const proc = await container.spawn('mkdir', ['-p', name]);
    await proc.exit;
    await refreshFiles();
  }, [container, refreshFiles]);

  const handleAiSend = useCallback(async () => {
    if (!aiInput.trim() || isStreaming) return;

    let context = '';
    for (const tab of openTabs) {
      context += `\n--- ${tab.path} ---\n${tab.content}\n`;
    }

    const prompt = context
      ? `Current files:\n${context}\n\nUser: ${aiInput}\n\nWrite code using: \`\`\`lang:path/file.ext`
      : aiInput;

    setAiInput('');
    await sendMessage(prompt);

    const currentMessages = useAppStore.getState().messages;
    const lastMessage = currentMessages[currentMessages.length - 1];
    const response = lastMessage?.role === 'assistant' ? lastMessage.content : null;

    if (response) {
      const codeBlockRegex = /```(?:(\w+):)?([^\n`]+)?\n([\s\S]*?)```/g;
      let match;
      while ((match = codeBlockRegex.exec(response)) !== null) {
        const [, , filename, code] = match;
        if (filename && code) {
          await writeFile(filename.trim(), code.trim());
        }
      }
      await refreshFiles();
    }
  }, [aiInput, isStreaming, openTabs, sendMessage, writeFile, refreshFiles]);

  const activeTab = openTabs[activeTabIndex];
  const currentProject = projects.find(p => p.id === driveProjectFolderId);

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#1e1e1e', color: '#d4d4d4' }}>
      {/* Sidebar */}
      {sidebarOpen && (
        <Box sx={{ width: sidebarWidth, flexShrink: 0 }}>
          <FileTree
            files={files}
            onFileSelect={openFile}
            onCreateFile={createFile}
            onCreateFolder={createFolder}
            onRefresh={refreshFiles}
            selectedFile={activeTab?.path}
          />
        </Box>
      )}

      {/* Toggle */}
      <Box
        sx={{
          width: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#252526',
          cursor: 'pointer',
          '&:hover': { bgcolor: '#2a2d2e' },
        }}
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <ChevronLeft sx={{ fontSize: 14 }} /> : <ChevronRight sx={{ fontSize: 14 }} />}
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Toolbar */}
        <Box sx={{
          height: 32,
          bgcolor: '#323233',
          display: 'flex',
          alignItems: 'center',
          px: 1,
          gap: 1,
          borderBottom: '1px solid #3c3c3c',
        }}>
          {/* Project Selector */}
          <Button
            size="small"
            onClick={(e) => { setProjectMenuAnchor(e.currentTarget); loadProjects(); }}
            endIcon={<KeyboardArrowDown sx={{ fontSize: 16 }} />}
            sx={{ textTransform: 'none', color: '#d4d4d4', fontSize: 12 }}
          >
            <Folder sx={{ fontSize: 16, mr: 0.5, color: '#dcb67a' }} />
            {currentProject?.name || 'Select Project'}
          </Button>

          <Menu
            anchorEl={projectMenuAnchor}
            open={Boolean(projectMenuAnchor)}
            onClose={() => setProjectMenuAnchor(null)}
            PaperProps={{ sx: { bgcolor: '#252526', color: '#d4d4d4', minWidth: 200 } }}
          >
            <MenuItem onClick={() => { setProjectMenuAnchor(null); /* TODO: New project dialog */ }}>
              <ListItemIcon><Add sx={{ color: '#d4d4d4' }} /></ListItemIcon>
              <ListItemText>New Project</ListItemText>
            </MenuItem>
            {loadingProjects ? (
              <MenuItem disabled><CircularProgress size={16} sx={{ mr: 1 }} /> Loading...</MenuItem>
            ) : projects.length === 0 ? (
              <MenuItem disabled>No projects found</MenuItem>
            ) : (
              projects.map(p => (
                <MenuItem
                  key={p.id}
                  selected={p.id === driveProjectFolderId}
                  onClick={() => switchProject(p.id)}
                >
                  <ListItemIcon><Folder sx={{ color: '#dcb67a' }} /></ListItemIcon>
                  <ListItemText>{p.name}</ListItemText>
                </MenuItem>
              ))
            )}
          </Menu>

          <Box sx={{ flex: 1 }} />

          <Tooltip title="Sync from Drive">
            <IconButton size="small" onClick={loadFromGoogleDrive} disabled={syncStatus === 'syncing' || !driveProjectFolderId}>
              {syncStatus === 'syncing' ? <CircularProgress size={14} /> : <CloudSync sx={{ fontSize: 16, color: syncStatus === 'synced' ? '#4caf50' : '#d4d4d4' }} />}
            </IconButton>
          </Tooltip>

          <Tooltip title="AI Assistant">
            <IconButton size="small" onClick={() => setAiDrawerOpen(true)}>
              <SmartToy sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>

          {serverUrl && (
            <>
              <Tooltip title={showPreview ? 'Hide Preview' : 'Show Preview'}>
                <IconButton size="small" onClick={() => setShowPreview(!showPreview)}>
                  <OpenInNew sx={{ fontSize: 16, color: showPreview ? '#4caf50' : '#d4d4d4' }} />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>

        {/* Editor + Preview Split */}
        <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Editor Area */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Tabs */}
            <Box sx={{ bgcolor: '#252526', borderBottom: '1px solid #3c3c3c' }}>
              <Tabs
                value={Math.min(activeTabIndex, openTabs.length - 1)}
                onChange={(_, v) => setActiveTabIndex(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ minHeight: 28, '& .MuiTab-root': { minHeight: 28, py: 0, px: 1, fontSize: 11, textTransform: 'none' } }}
              >
                {openTabs.map((tab, i) => (
                  <Tab
                    key={tab.path}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {tab.path.split('/').pop()}{tab.dirty && ' •'}
                        <Close sx={{ fontSize: 12, '&:hover': { color: 'error.main' } }} onClick={(e) => { e.stopPropagation(); closeTab(i); }} />
                      </Box>
                    }
                  />
                ))}
              </Tabs>
            </Box>

            {/* Editor */}
            <Box sx={{ flex: 1, minHeight: 0 }}>
              {activeTab ? (
                <Editor
                  height="100%"
                  language={getLanguage(activeTab.path)}
                  value={activeTab.content}
                  onChange={(value) => {
                    setOpenTabs(prev => prev.map((t, i) => i === activeTabIndex ? { ...t, content: value || '', dirty: true } : t));
                  }}
                  theme="vs-dark"
                  options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: 'on', wordWrap: 'on', scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2 }}
                  onMount={(editor) => { editor.addCommand(2048 | 49, saveCurrentFile); }}
                />
              ) : (
                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1 }}>
                  <FolderOpen sx={{ fontSize: 48, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">Select a file or create one</Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Preview Panel */}
          {serverUrl && showPreview && (
            <Box sx={{ width: 400, borderLeft: '1px solid #3c3c3c', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ height: 28, bgcolor: '#252526', display: 'flex', alignItems: 'center', px: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>PREVIEW</Typography>
                <Box sx={{ flex: 1 }} />
                <Tooltip title="Open in new tab">
                  <IconButton size="small" onClick={() => window.open(serverUrl, '_blank')}>
                    <OpenInNew sx={{ fontSize: 12 }} />
                  </IconButton>
                </Tooltip>
                <IconButton size="small" onClick={() => setShowPreview(false)}>
                  <Close sx={{ fontSize: 12 }} />
                </IconButton>
              </Box>
              <iframe src={serverUrl} style={{ flex: 1, border: 'none', background: '#fff' }} title="App Preview" />
            </Box>
          )}
        </Box>

        {/* Terminal */}
        <Box sx={{ height: terminalHeight, borderTop: '1px solid #3c3c3c', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ height: 24, bgcolor: '#252526', display: 'flex', alignItems: 'center', px: 1, gap: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, mr: 1 }}>TERMINAL</Typography>
            <Button size="small" sx={{ fontSize: 9, py: 0, minWidth: 'auto', px: 0.5 }} onClick={() => runCommand('npm install')}>install</Button>
            <Button size="small" sx={{ fontSize: 9, py: 0, minWidth: 'auto', px: 0.5 }} onClick={() => runCommand('npm run dev')}>dev</Button>
            <Button size="small" sx={{ fontSize: 9, py: 0, minWidth: 'auto', px: 0.5 }} onClick={() => runCommand('npm run build')}>build</Button>
            <Box sx={{ flex: 1 }} />
            {serverUrl && <Chip size="small" label="●" color="success" sx={{ height: 16, '& .MuiChip-label': { px: 0.5, fontSize: 8 } }} />}
          </Box>
          <Box ref={terminalRef} sx={{ flex: 1, '& .xterm': { height: '100%', p: 0.5 } }} />
        </Box>
      </Box>

      {/* AI Drawer */}
      <Drawer anchor="right" open={aiDrawerOpen} onClose={() => setAiDrawerOpen(false)} PaperProps={{ sx: { width: 360, bgcolor: '#1e1e1e', color: '#d4d4d4' } }}>
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 1.5, borderBottom: '1px solid #3c3c3c', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle2">AI Assistant</Typography>
            <Chip size="small" label={currentProvider} sx={{ height: 20, fontSize: 10 }} />
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
            {messages.map((msg, i) => (
              <Box key={i} sx={{ mb: 1.5, p: 1, borderRadius: 1, bgcolor: msg.role === 'user' ? '#264f78' : '#2d2d2d' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>{msg.role === 'user' ? 'You' : 'AI'}</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{msg.content}</Typography>
              </Box>
            ))}
            {isStreaming && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CircularProgress size={14} /><Typography variant="caption">Thinking...</Typography></Box>}
          </Box>
          <Box sx={{ p: 1.5, borderTop: '1px solid #3c3c3c' }}>
            <TextField
              fullWidth
              size="small"
              multiline
              maxRows={3}
              placeholder="Ask AI to write code..."
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiSend(); } }}
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#2d2d2d', fontSize: 12 } }}
              InputProps={{ endAdornment: <IconButton size="small" onClick={handleAiSend} disabled={isStreaming}><Send sx={{ fontSize: 16 }} /></IconButton> }}
            />
          </Box>
        </Box>
      </Drawer>
    </Box>
  );
}
