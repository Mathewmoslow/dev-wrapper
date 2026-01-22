import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message, ProviderName, HealthCheckResult, DriveFile, GitHubRepo } from '../lib/types';
import { createProvider } from '../providers';
import { GoogleDriveClient } from '../lib/google-drive';
import { GitHubClient } from '../lib/github';

// Read API keys from Vercel env vars (fallback to empty for localStorage override)
const ENV_KEYS = {
  anthropic: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
  openai: import.meta.env.VITE_OPENAI_API_KEY || '',
  gemini: import.meta.env.VITE_GEMINI_API_KEY || '',
  github: import.meta.env.VITE_GITHUB_TOKEN || '',
};

interface ProviderHealth {
  anthropic: HealthCheckResult | null;
  openai: HealthCheckResult | null;
  gemini: HealthCheckResult | null;
}

interface AppState {
  // Auth tokens
  anthropicKey: string;
  openaiKey: string;
  geminiKey: string;
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
  tokenUsage: { input: number; output: number };

  // Provider health
  providerHealth: ProviderHealth;

  // File explorer
  currentFiles: DriveFile[];
  currentPath: string[];
  selectedFile: DriveFile | null;
  fileContent: string;

  // GitHub
  repos: GitHubRepo[];
  commits: Array<{ sha: string; message: string; author: { name: string; date: string } }>;

  // UI state
  view: 'chat' | 'files' | 'settings' | 'auth';
  sidebarOpen: boolean;

  // Actions
  setApiKey: (provider: ProviderName, key: string) => void;
  setGoogleToken: (token: string) => void;
  setGithubToken: (token: string) => void;
  setCurrentProvider: (provider: ProviderName) => void;
  setDriveFolder: (folderId: string) => void;
  setGithubRepo: (repo: string) => void;

  addMessage: (message: Message) => void;
  clearMessages: () => void;
  setStreaming: (streaming: boolean) => void;
  appendStreamContent: (content: string) => void;
  finalizeStream: () => void;

  checkProviderHealth: (provider: ProviderName) => Promise<void>;
  checkAllProviders: () => Promise<void>;

  loadDriveFiles: (folderId?: string) => Promise<void>;
  loadFileContent: (file: DriveFile) => Promise<void>;
  saveFile: (content: string) => Promise<void>;
  createFile: (name: string, content: string) => Promise<void>;

  loadGithubRepos: () => Promise<void>;
  loadCommits: () => Promise<void>;
  commitFile: (path: string, content: string, message: string) => Promise<void>;

  setView: (view: 'chat' | 'files' | 'settings' | 'auth') => void;
  toggleSidebar: () => void;

  sendMessage: (content: string) => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state - prefer env vars, localStorage can override
      anthropicKey: ENV_KEYS.anthropic,
      openaiKey: ENV_KEYS.openai,
      geminiKey: ENV_KEYS.gemini,
      googleAccessToken: '',
      githubToken: ENV_KEYS.github,

      currentProvider: 'anthropic',
      driveProjectFolderId: '',
      githubRepo: '',

      messages: [],
      isStreaming: false,
      streamingContent: '',
      tokenUsage: { input: 0, output: 0 },

      providerHealth: {
        anthropic: null,
        openai: null,
        gemini: null,
      },

      currentFiles: [],
      currentPath: [],
      selectedFile: null,
      fileContent: '',

      repos: [],
      commits: [],

      view: 'auth',
      sidebarOpen: true,

      // Actions
      setApiKey: (provider, key) => {
        set({ [`${provider}Key`]: key });
      },

      setGoogleToken: (token) => set({ googleAccessToken: token }),
      setGithubToken: (token) => set({ githubToken: token }),
      setCurrentProvider: (provider) => set({ currentProvider: provider }),
      setDriveFolder: (folderId) => set({ driveProjectFolderId: folderId }),
      setGithubRepo: (repo) => set({ githubRepo: repo }),

      addMessage: (message) => {
        set((state) => ({
          messages: [...state.messages, { ...message, timestamp: Date.now() }],
        }));
      },

      clearMessages: () => set({ messages: [], tokenUsage: { input: 0, output: 0 } }),

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
        }
      },

      checkProviderHealth: async (provider) => {
        const state = get();
        const apiKey = state[`${provider}Key` as keyof AppState] as string;
        const providerInstance = createProvider(provider, apiKey);
        const health = await providerInstance.checkHealth();

        set((state) => ({
          providerHealth: {
            ...state.providerHealth,
            [provider]: health,
          },
        }));
      },

      checkAllProviders: async () => {
        const { checkProviderHealth } = get();
        await Promise.all([
          checkProviderHealth('anthropic'),
          checkProviderHealth('openai'),
          checkProviderHealth('gemini'),
        ]);
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

      sendMessage: async (content) => {
        const state = get();
        const apiKey = state[`${state.currentProvider}Key` as keyof AppState] as string;

        if (!apiKey) {
          throw new Error('No API key configured for ' + state.currentProvider);
        }

        // Add user message
        state.addMessage({ role: 'user', content });
        set({ isStreaming: true, streamingContent: '' });

        try {
          const provider = createProvider(state.currentProvider, apiKey);

          // Build system prompt with file context
          let systemPrompt = `You are a helpful AI coding assistant. You're working on a project stored in Google Drive and synced to GitHub.`;

          if (state.selectedFile) {
            systemPrompt += `\n\nCurrently viewing file: ${state.selectedFile.name}\n\nFile content:\n\`\`\`\n${state.fileContent}\n\`\`\``;
          }

          const stream = provider.stream({
            messages: [...state.messages, { role: 'user', content }],
            systemPrompt,
          });

          for await (const chunk of stream) {
            if (chunk.type === 'text' && chunk.text) {
              get().appendStreamContent(chunk.text);
            } else if (chunk.type === 'done') {
              break;
            } else if (chunk.type === 'error') {
              throw new Error(chunk.error);
            }
          }

          get().finalizeStream();
        } catch (error) {
          set({ isStreaming: false, streamingContent: '' });
          throw error;
        }
      },
    }),
    {
      name: 'studiora-web-storage',
      partialize: (state) => ({
        anthropicKey: state.anthropicKey,
        openaiKey: state.openaiKey,
        geminiKey: state.geminiKey,
        googleAccessToken: state.googleAccessToken,
        githubToken: state.githubToken,
        currentProvider: state.currentProvider,
        driveProjectFolderId: state.driveProjectFolderId,
        githubRepo: state.githubRepo,
      }),
    }
  )
);
