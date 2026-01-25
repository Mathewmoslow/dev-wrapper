import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message, ProviderName, HealthCheckResult, DriveFile, GitHubRepo, PreviewState, PreviewMode, ConsoleEntry } from '../lib/types';
import { GoogleDriveClient } from '../lib/google-drive';
import { GitHubClient } from '../lib/github';
import { StudiorService } from '../lib/studiora-service';
import type {
  ProjectConfig,
  SessionSummary,
} from '../lib/studiora-config';
import {
  estimateTokens,
  CONTEXT_LIMITS,
  COMPACTION_THRESHOLD,
  generateCompactionPrompt,
  generateSystemPrompt,
} from '../lib/studiora-config';
import { getGlobalToast } from '../components/ToastProvider';

// Helper to show toast notifications from store actions
const showToast = (message: string, severity: 'error' | 'success' | 'warning' | 'info' = 'info') => {
  const toast = getGlobalToast();
  if (toast) {
    switch (severity) {
      case 'error': toast.showError(message); break;
      case 'success': toast.showSuccess(message); break;
      case 'warning': toast.showWarning(message); break;
      default: toast.showInfo(message);
    }
  }
};

interface ProviderHealth {
  anthropic: HealthCheckResult | null;
  openai: HealthCheckResult | null;
  gemini: HealthCheckResult | null;
}

interface ContextUsage {
  used: number;
  max: number;
  percentage: number;
}

interface AppState {
  // Auth tokens (only Google and GitHub need browser-side tokens)
  googleAccessToken: string;
  githubToken: string;

  // Current selections
  currentProvider: ProviderName;
  driveProjectFolderId: string;
  githubRepo: string;

  // Conversation
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;

  // Context tracking
  contextUsage: ContextUsage;
  needsCompaction: boolean;

  // Project config (from .studiora/)
  projectConfig: ProjectConfig | null;
  latestSummary: SessionSummary | null;
  projectInitialized: boolean;

  // Provider health (from server)
  providerHealth: ProviderHealth;
  providersConfigured: { anthropic: boolean; openai: boolean; gemini: boolean };

  // File explorer
  currentFiles: DriveFile[];
  currentPath: string[];
  selectedFile: DriveFile | null;
  fileContent: string;

  // GitHub
  repos: GitHubRepo[];
  commits: Array<{ sha: string; message: string; author: { name: string; date: string } }>;

  // UI state
  view: 'chat' | 'files' | 'terminal' | 'workspace' | 'settings' | 'auth' | 'init';
  sidebarOpen: boolean;

  // Code Preview state
  previewState: PreviewState;
  previewPanelOpen: boolean;

  // Actions
  setGoogleToken: (token: string) => void;
  setGithubToken: (token: string) => void;
  setCurrentProvider: (provider: ProviderName) => void;
  setDriveFolder: (folderId: string) => void;
  setProjectConfig: (config: ProjectConfig | null) => void;
  setGithubRepo: (repo: string) => void;

  addMessage: (message: Message) => void;
  clearMessages: () => void;
  setStreaming: (streaming: boolean) => void;
  appendStreamContent: (content: string) => void;
  finalizeStream: () => void;
  updateContextUsage: () => void;

  checkProvidersConfigured: () => Promise<void>;

  // Studiora service actions
  initStudiorService: () => StudiorService | null;
  loadProjectConfig: () => Promise<void>;
  saveProjectConfig: (config: ProjectConfig) => Promise<void>;
  initNewProject: (name: string, description: string) => Promise<void>;

  // Conversation persistence
  saveConversation: (name?: string) => Promise<void>;
  loadConversation: (fileId: string) => Promise<void>;
  listSavedConversations: () => Promise<{ id: string; name: string; updated: string }[]>;

  // Compaction
  compactConversation: () => Promise<void>;

  loadDriveFiles: (folderId?: string) => Promise<void>;
  loadFileContent: (file: DriveFile) => Promise<void>;
  saveFile: (content: string) => Promise<void>;
  createFile: (name: string, content: string) => Promise<void>;

  loadGithubRepos: () => Promise<void>;
  loadCommits: () => Promise<void>;
  commitFile: (path: string, content: string, message: string) => Promise<void>;

  setView: (view: 'chat' | 'files' | 'terminal' | 'workspace' | 'settings' | 'auth' | 'init') => void;
  toggleSidebar: () => void;

  // Preview actions
  setPreviewMode: (mode: PreviewMode) => void;
  setPreviewFiles: (files: Record<string, string>) => void;
  setPreviewEntryFile: (file: string) => void;
  addToConsole: (entry: ConsoleEntry) => void;
  clearConsole: () => void;
  setPreviewError: (error: string | null) => void;
  setPreviewRunning: (running: boolean) => void;
  togglePreviewPanel: () => void;
  openPreviewWithFile: (filename: string, content: string) => void;
  detectPreviewMode: (filename: string) => PreviewMode;

  sendMessage: (content: string) => Promise<void>;
  handleSlashCommand: (command: string) => Promise<{ handled: boolean; response?: string }>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      googleAccessToken: '',
      githubToken: '',

      currentProvider: 'anthropic',
      driveProjectFolderId: '',
      githubRepo: '',

      messages: [],
      isStreaming: false,
      streamingContent: '',

      contextUsage: { used: 0, max: 200000, percentage: 0 },
      needsCompaction: false,

      projectConfig: null,
      latestSummary: null,
      projectInitialized: false,

      providerHealth: {
        anthropic: null,
        openai: null,
        gemini: null,
      },
      providersConfigured: {
        anthropic: false,
        openai: false,
        gemini: false,
      },

      currentFiles: [],
      currentPath: [],
      selectedFile: null,
      fileContent: '',

      repos: [],
      commits: [],

      view: 'auth',
      sidebarOpen: true,

      // Code Preview initial state
      previewState: {
        mode: 'none',
        files: {},
        entryFile: '',
        consoleOutput: [],
        error: null,
        isRunning: false,
      },
      previewPanelOpen: false,

      // Actions
      setGoogleToken: (token) => set({ googleAccessToken: token }),
      setGithubToken: (token) => set({ githubToken: token }),
      setCurrentProvider: (provider) => {
        set({ currentProvider: provider });
        get().updateContextUsage();
      },
      setDriveFolder: (folderId) => {
        set({ driveProjectFolderId: folderId });
        // Load project config when folder changes
        get().loadProjectConfig();
      },
      setProjectConfig: (config) => set({ projectConfig: config }),
      setGithubRepo: (repo) => set({ githubRepo: repo }),

      addMessage: (message) => {
        set((state) => ({
          messages: [...state.messages, { ...message, timestamp: Date.now() }],
        }));
        get().updateContextUsage();
      },

      clearMessages: () => {
        set({ messages: [], contextUsage: { used: 0, max: CONTEXT_LIMITS[get().currentProvider], percentage: 0 }, needsCompaction: false });
      },

      setStreaming: (streaming) => set({ isStreaming: streaming }),

      appendStreamContent: (content) => {
        set((state) => ({
          streamingContent: state.streamingContent + content,
        }));
      },

      finalizeStream: () => {
        const { streamingContent, messages } = get();
        if (streamingContent) {
          set({
            messages: [
              ...messages,
              { role: 'assistant', content: streamingContent, timestamp: Date.now() },
            ],
            streamingContent: '',
            isStreaming: false,
          });
          get().updateContextUsage();
        }
      },

      updateContextUsage: () => {
        const { messages, currentProvider, projectConfig, latestSummary } = get();

        // Calculate total tokens including system prompt
        let totalTokens = 0;

        // System prompt tokens
        if (projectConfig) {
          const systemPrompt = generateSystemPrompt(projectConfig, latestSummary || undefined);
          totalTokens += estimateTokens(systemPrompt);
        }

        // Message tokens
        for (const msg of messages) {
          totalTokens += estimateTokens(msg.content);
        }

        const maxTokens = CONTEXT_LIMITS[currentProvider];
        const percentage = totalTokens / maxTokens;

        set({
          contextUsage: { used: totalTokens, max: maxTokens, percentage },
          needsCompaction: percentage >= COMPACTION_THRESHOLD,
        });
      },

      checkProvidersConfigured: async () => {
        try {
          const response = await fetch('/api/health');
          const data = await response.json();
          set({
            providersConfigured: data,
            providerHealth: {
              anthropic: data.anthropic
                ? { status: 'green', message: 'Configured', hasApiKey: true }
                : { status: 'red', message: 'Not configured', hasApiKey: false },
              openai: data.openai
                ? { status: 'green', message: 'Configured', hasApiKey: true }
                : { status: 'red', message: 'Not configured', hasApiKey: false },
              gemini: data.gemini
                ? { status: 'green', message: 'Configured', hasApiKey: true }
                : { status: 'red', message: 'Not configured', hasApiKey: false },
            },
          });
        } catch (error) {
          console.error('Failed to check providers:', error);
        }
      },

      initStudiorService: () => {
        const { googleAccessToken, driveProjectFolderId } = get();
        if (!googleAccessToken || !driveProjectFolderId) return null;
        return new StudiorService(googleAccessToken, driveProjectFolderId);
      },

      loadProjectConfig: async () => {
        const service = get().initStudiorService();
        if (!service) return;

        try {
          const config = await service.getProjectConfig();
          const summary = await service.getLatestSummary();
          set({
            projectConfig: config,
            latestSummary: summary,
            projectInitialized: !!config,
          });
          get().updateContextUsage();
        } catch (error) {
          console.error('Failed to load project config:', error);
          showToast('Failed to load project configuration', 'error');
        }
      },

      saveProjectConfig: async (config) => {
        const service = get().initStudiorService();
        if (!service) return;

        try {
          await service.saveProjectConfig(config);
          set({ projectConfig: config });
          showToast('Project configuration saved', 'success');
        } catch (error) {
          console.error('Failed to save project config:', error);
          showToast('Failed to save project configuration', 'error');
        }
      },

      initNewProject: async (name, description) => {
        const service = get().initStudiorService();
        if (!service) return;

        try {
          const config = await service.initProject(name, description);
          set({ projectConfig: config, projectInitialized: true });
          showToast(`Project "${name}" initialized!`, 'success');
        } catch (error) {
          console.error('Failed to init project:', error);
          showToast('Failed to initialize project', 'error');
        }
      },

      saveConversation: async (name) => {
        const service = get().initStudiorService();
        if (!service) return;

        const { messages, currentProvider } = get();
        const conversationState = {
          id: Date.now().toString(),
          name: name || `Conversation ${new Date().toLocaleDateString()}`,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          provider: currentProvider,
          messages: messages.map(m => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
            timestamp: m.timestamp || Date.now(),
          })),
          totalTokens: get().contextUsage.used,
          maxTokens: get().contextUsage.max,
        };

        try {
          if (name) {
            await service.saveConversationAs(conversationState, name);
          } else {
            await service.saveCurrentConversation(conversationState);
          }
        } catch (error) {
          console.error('Failed to save conversation:', error);
          showToast('Failed to save conversation', 'warning');
        }
      },

      loadConversation: async (fileId) => {
        const service = get().initStudiorService();
        if (!service) return;

        try {
          const conversation = await service.loadConversation(fileId);
          if (conversation) {
            set({
              messages: conversation.messages.map(m => ({
                role: m.role,
                content: m.content,
                timestamp: m.timestamp,
              })),
              currentProvider: conversation.provider,
            });
            get().updateContextUsage();
            showToast('Conversation loaded', 'success');
          }
        } catch (error) {
          console.error('Failed to load conversation:', error);
          showToast('Failed to load conversation', 'error');
        }
      },

      listSavedConversations: async () => {
        const service = get().initStudiorService();
        if (!service) return [];

        try {
          return await service.listConversations();
        } catch (error) {
          console.error('Failed to list conversations:', error);
          showToast('Failed to list saved conversations', 'error');
          return [];
        }
      },

      compactConversation: async () => {
        const { messages, currentProvider } = get();
        if (messages.length === 0) return;

        // Generate summary using AI
        const compactionPrompt = generateCompactionPrompt(
          messages.map(m => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
            timestamp: m.timestamp || Date.now(),
          }))
        );

        set({ isStreaming: true });

        try {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: currentProvider,
              messages: [{ role: 'user', content: compactionPrompt }],
              systemPrompt: 'You are a helpful assistant that summarizes conversations.',
            }),
          });

          if (!response.ok) throw new Error('Compaction failed');

          const data = await response.json();
          const summaryContent = data.content;

          // Save summary
          const service = get().initStudiorService();
          if (service) {
            const summary: SessionSummary = {
              id: Date.now().toString(),
              date: new Date().toISOString().split('T')[0],
              title: `Session ${new Date().toLocaleDateString()}`,
              summary: summaryContent,
              keyDecisions: [], // Could parse from AI response
              filesModified: [], // Could track this
              tokensUsed: get().contextUsage.used,
            };
            await service.saveSummary(summary);
            set({ latestSummary: summary });
          }

          // Clear messages and start fresh
          set({
            messages: [],
            isStreaming: false,
            needsCompaction: false,
          });
          get().updateContextUsage();
          showToast('Conversation compacted - history summarized', 'info');
        } catch (error) {
          console.error('Compaction failed:', error);
          set({ isStreaming: false });
          showToast('Failed to compact conversation', 'error');
        }
      },

      handleSlashCommand: async (command) => {
        const parts = command.trim().split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1).join(' ');

        switch (cmd) {
          case '/switch': {
            const provider = args.toLowerCase() as ProviderName;
            if (['anthropic', 'openai', 'gemini'].includes(provider)) {
              get().setCurrentProvider(provider);
              return { handled: true, response: `Switched to ${provider}` };
            }
            return { handled: true, response: 'Usage: /switch <anthropic|openai|gemini>' };
          }

          case '/save': {
            await get().saveConversation(args || undefined);
            return { handled: true, response: args ? `Saved as "${args}"` : 'Conversation saved' };
          }

          case '/load': {
            const conversations = await get().listSavedConversations();
            if (conversations.length === 0) {
              return { handled: true, response: 'No saved conversations found' };
            }
            // Return list for UI to handle
            return {
              handled: true,
              response: 'Available conversations:\n' +
                conversations.map((c, i) => `${i + 1}. ${c.name} (${c.updated})`).join('\n'),
            };
          }

          case '/compact': {
            await get().compactConversation();
            return { handled: true, response: 'Conversation compacted and summarized' };
          }

          case '/clear': {
            get().clearMessages();
            return { handled: true, response: 'Conversation cleared' };
          }

          case '/new': {
            get().setView('init');
            return { handled: true, response: 'Starting new project wizard...' };
          }

          case '/context': {
            const { contextUsage } = get();
            const pct = (contextUsage.percentage * 100).toFixed(1);
            return {
              handled: true,
              response: `Context: ${contextUsage.used.toLocaleString()} / ${contextUsage.max.toLocaleString()} tokens (${pct}%)`,
            };
          }

          case '/help': {
            return {
              handled: true,
              response: `Available commands:
/switch <provider> - Switch AI provider (anthropic, openai, gemini)
/save [name] - Save current conversation
/load - List saved conversations
/compact - Summarize and compact context
/clear - Clear conversation
/new - Start new project wizard
/context - Show context usage
/help - Show this help`,
            };
          }

          default:
            return { handled: false };
        }
      },

      loadDriveFiles: async (folderId) => {
        const { googleAccessToken, driveProjectFolderId } = get();
        if (!googleAccessToken) return;

        const client = new GoogleDriveClient(googleAccessToken);
        const targetFolder = folderId || driveProjectFolderId || 'root';
        const files = await client.listFiles(targetFolder);

        set({ currentFiles: files });
      },

      loadFileContent: async (file) => {
        const { googleAccessToken } = get();
        if (!googleAccessToken) return;

        const client = new GoogleDriveClient(googleAccessToken);
        const content = await client.getFileContent(file.id);

        set({ selectedFile: file, fileContent: content });
      },

      saveFile: async (content) => {
        const { googleAccessToken, selectedFile } = get();
        if (!googleAccessToken || !selectedFile) return;

        const client = new GoogleDriveClient(googleAccessToken);
        await client.updateFile(selectedFile.id, content);

        set({ fileContent: content });
      },

      createFile: async (name, content) => {
        const { googleAccessToken, driveProjectFolderId, loadDriveFiles } = get();
        if (!googleAccessToken) return;

        const client = new GoogleDriveClient(googleAccessToken);
        await client.createFile(name, content, driveProjectFolderId || 'root');

        await loadDriveFiles();
      },

      loadGithubRepos: async () => {
        const { githubToken } = get();
        if (!githubToken) return;

        const client = new GitHubClient(githubToken);
        const repos = await client.listRepos();

        set({ repos });
      },

      loadCommits: async () => {
        const { githubToken, githubRepo } = get();
        if (!githubToken || !githubRepo) return;

        const client = new GitHubClient(githubToken);
        client.setRepo(githubRepo);
        const commits = await client.listCommits();

        set({ commits });
      },

      commitFile: async (path, content, message) => {
        const { githubToken, githubRepo, loadCommits } = get();
        if (!githubToken || !githubRepo) return;

        const client = new GitHubClient(githubToken);
        client.setRepo(githubRepo);
        await client.createOrUpdateFile(path, content, message);

        await loadCommits();
      },

      setView: (view) => set({ view }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      // Preview actions
      setPreviewMode: (mode) => set((state) => ({
        previewState: { ...state.previewState, mode },
      })),

      setPreviewFiles: (files) => set((state) => ({
        previewState: { ...state.previewState, files },
      })),

      setPreviewEntryFile: (file) => set((state) => ({
        previewState: { ...state.previewState, entryFile: file },
      })),

      addToConsole: (entry) => set((state) => ({
        previewState: {
          ...state.previewState,
          consoleOutput: [...state.previewState.consoleOutput, entry],
        },
      })),

      clearConsole: () => set((state) => ({
        previewState: { ...state.previewState, consoleOutput: [] },
      })),

      setPreviewError: (error) => set((state) => ({
        previewState: { ...state.previewState, error },
      })),

      setPreviewRunning: (running) => set((state) => ({
        previewState: { ...state.previewState, isRunning: running },
      })),

      togglePreviewPanel: () => set((state) => ({ previewPanelOpen: !state.previewPanelOpen })),

      detectPreviewMode: (filename: string): PreviewMode => {
        const ext = filename.split('.').pop()?.toLowerCase();
        switch (ext) {
          case 'jsx':
          case 'tsx':
            return 'sandpack-react';
          case 'html':
          case 'js':
          case 'css':
            return 'sandpack-vanilla';
          case 'py':
            return 'pyodide';
          default:
            return 'none';
        }
      },

      openPreviewWithFile: (filename, content) => {
        const mode = get().detectPreviewMode(filename);
        if (mode !== 'none') {
          set({
            previewState: {
              mode,
              files: { [filename]: content },
              entryFile: filename,
              consoleOutput: [],
              error: null,
              isRunning: false,
            },
            previewPanelOpen: true,
          });
        }
      },

      sendMessage: async (content) => {
        const state = get();

        // Check for slash commands
        if (content.startsWith('/')) {
          const result = await state.handleSlashCommand(content);
          if (result.handled) {
            // Add command and response as messages
            state.addMessage({ role: 'user', content });
            if (result.response) {
              set((s) => ({
                messages: [...s.messages, { role: 'assistant', content: result.response!, timestamp: Date.now() }],
              }));
            }
            return;
          }
        }

        // Add user message
        state.addMessage({ role: 'user', content });
        set({ isStreaming: true, streamingContent: '' });

        try {
          // Build system prompt with project context
          let systemPrompt = '';

          if (state.projectConfig) {
            systemPrompt = generateSystemPrompt(state.projectConfig, state.latestSummary || undefined);
          } else {
            systemPrompt = `You are a helpful AI coding assistant. You're working on a project stored in Google Drive and synced to GitHub.`;
          }

          if (state.selectedFile) {
            systemPrompt += `\n\nCurrently viewing file: ${state.selectedFile.name}\n\nFile content:\n\`\`\`\n${state.fileContent}\n\`\`\``;
          }

          // Call server-side API (keys are kept server-side)
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: state.currentProvider,
              messages: [...state.messages, { role: 'user', content }],
              systemPrompt,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'API request failed');
          }

          const data = await response.json();

          set({
            messages: [
              ...get().messages,
              { role: 'assistant', content: data.content, timestamp: Date.now() },
            ],
            isStreaming: false,
          });

          get().updateContextUsage();

          // Auto-save conversation periodically
          if (get().messages.length % 10 === 0) {
            get().saveConversation();
          }
        } catch (error) {
          set({ isStreaming: false, streamingContent: '' });
          throw error;
        }
      },
    }),
    {
      name: 'studiora-web-storage',
      partialize: (state) => ({
        // Auth tokens
        googleAccessToken: state.googleAccessToken,
        githubToken: state.githubToken,
        // Provider selection
        currentProvider: state.currentProvider,
        // Project configuration
        driveProjectFolderId: state.driveProjectFolderId,
        githubRepo: state.githubRepo,
        projectConfig: state.projectConfig,
        // Conversation history (critical for UX)
        messages: state.messages,
        latestSummary: state.latestSummary,
        // UI state
        sidebarOpen: state.sidebarOpen,
        view: state.view,
      }),
    }
  )
);
