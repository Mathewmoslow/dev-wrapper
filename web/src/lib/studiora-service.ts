// Service for managing .studiora/ folder in Google Drive

import { GoogleDriveClient } from './google-drive';
import type {
  ProjectConfig,
  ConversationState,
  SessionSummary,
} from './studiora-config';
import {
  createDefaultConfig,
  estimateTokens,
  CONTEXT_LIMITS,
} from './studiora-config';

export class StudiorService {
  private drive: GoogleDriveClient;
  private projectFolderId: string;
  private studioraFolderId: string | null = null;
  private summariesFolderId: string | null = null;
  private conversationsFolderId: string | null = null;

  constructor(accessToken: string, projectFolderId: string) {
    this.drive = new GoogleDriveClient(accessToken);
    this.projectFolderId = projectFolderId;
  }

  // Initialize .studiora folder structure
  async init(): Promise<void> {
    // Check if .studiora folder exists
    const files = await this.drive.listFiles(this.projectFolderId);
    const studioraFolder = files.find(
      f => f.name === '.studiora' && f.mimeType === 'application/vnd.google-apps.folder'
    );

    if (studioraFolder) {
      this.studioraFolderId = studioraFolder.id;
    } else {
      // Create .studiora folder
      const folder = await this.drive.createFolder('.studiora', this.projectFolderId);
      this.studioraFolderId = folder.id;
    }

    // Check/create subfolders
    const studioraFiles = await this.drive.listFiles(this.studioraFolderId);

    const summariesFolder = studioraFiles.find(
      f => f.name === 'summaries' && f.mimeType === 'application/vnd.google-apps.folder'
    );
    if (summariesFolder) {
      this.summariesFolderId = summariesFolder.id;
    } else {
      const folder = await this.drive.createFolder('summaries', this.studioraFolderId);
      this.summariesFolderId = folder.id;
    }

    const conversationsFolder = studioraFiles.find(
      f => f.name === 'conversations' && f.mimeType === 'application/vnd.google-apps.folder'
    );
    if (conversationsFolder) {
      this.conversationsFolderId = conversationsFolder.id;
    } else {
      const folder = await this.drive.createFolder('conversations', this.studioraFolderId);
      this.conversationsFolderId = folder.id;
    }
  }

  // Get or create project config
  async getProjectConfig(): Promise<ProjectConfig | null> {
    if (!this.studioraFolderId) await this.init();

    const files = await this.drive.listFiles(this.studioraFolderId!);
    const configFile = files.find(f => f.name === 'project.json');

    if (configFile) {
      const content = await this.drive.getFileContent(configFile.id);
      try {
        return JSON.parse(content) as ProjectConfig;
      } catch {
        return null;
      }
    }
    return null;
  }

  async saveProjectConfig(config: ProjectConfig): Promise<void> {
    if (!this.studioraFolderId) await this.init();

    const files = await this.drive.listFiles(this.studioraFolderId!);
    const configFile = files.find(f => f.name === 'project.json');

    config.updated = new Date().toISOString();
    const content = JSON.stringify(config, null, 2);

    if (configFile) {
      await this.drive.updateFile(configFile.id, content);
    } else {
      await this.drive.createFile('project.json', content, this.studioraFolderId!);
    }
  }

  // Initialize a new project with config
  async initProject(name: string, description: string): Promise<ProjectConfig> {
    await this.init();
    const config = createDefaultConfig(name, description);
    await this.saveProjectConfig(config);
    return config;
  }

  // Conversation management
  async getCurrentConversation(): Promise<ConversationState | null> {
    if (!this.conversationsFolderId) await this.init();

    const files = await this.drive.listFiles(this.conversationsFolderId!);
    const currentFile = files.find(f => f.name === 'current.json');

    if (currentFile) {
      const content = await this.drive.getFileContent(currentFile.id);
      try {
        return JSON.parse(content) as ConversationState;
      } catch {
        return null;
      }
    }
    return null;
  }

  async saveCurrentConversation(conversation: ConversationState): Promise<void> {
    if (!this.conversationsFolderId) await this.init();

    const files = await this.drive.listFiles(this.conversationsFolderId!);
    const currentFile = files.find(f => f.name === 'current.json');

    conversation.updated = new Date().toISOString();
    const content = JSON.stringify(conversation, null, 2);

    if (currentFile) {
      await this.drive.updateFile(currentFile.id, content);
    } else {
      await this.drive.createFile('current.json', content, this.conversationsFolderId!);
    }
  }

  async saveConversationAs(conversation: ConversationState, name: string): Promise<void> {
    if (!this.conversationsFolderId) await this.init();

    const filename = `${name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
    conversation.name = name;
    conversation.updated = new Date().toISOString();
    const content = JSON.stringify(conversation, null, 2);

    await this.drive.createFile(filename, content, this.conversationsFolderId!);
  }

  async listConversations(): Promise<{ id: string; name: string; updated: string }[]> {
    if (!this.conversationsFolderId) await this.init();

    const files = await this.drive.listFiles(this.conversationsFolderId!);
    const conversations: { id: string; name: string; updated: string }[] = [];

    for (const file of files) {
      if (file.name.endsWith('.json')) {
        try {
          const content = await this.drive.getFileContent(file.id);
          const conv = JSON.parse(content) as ConversationState;
          conversations.push({
            id: file.id,
            name: conv.name || file.name.replace('.json', ''),
            updated: conv.updated,
          });
        } catch {
          // Skip invalid files
        }
      }
    }

    return conversations.sort((a, b) =>
      new Date(b.updated).getTime() - new Date(a.updated).getTime()
    );
  }

  async loadConversation(fileId: string): Promise<ConversationState | null> {
    try {
      const content = await this.drive.getFileContent(fileId);
      return JSON.parse(content) as ConversationState;
    } catch {
      return null;
    }
  }

  // Summary management
  async saveSummary(summary: SessionSummary): Promise<void> {
    if (!this.summariesFolderId) await this.init();

    const filename = `${summary.date}-${summary.id}.json`;
    const content = JSON.stringify(summary, null, 2);

    await this.drive.createFile(filename, content, this.summariesFolderId!);
  }

  async getLatestSummary(): Promise<SessionSummary | null> {
    if (!this.summariesFolderId) await this.init();

    const files = await this.drive.listFiles(this.summariesFolderId!);
    if (files.length === 0) return null;

    // Sort by name (date prefix) descending
    const sortedFiles = files
      .filter(f => f.name.endsWith('.json'))
      .sort((a, b) => b.name.localeCompare(a.name));

    if (sortedFiles.length === 0) return null;

    try {
      const content = await this.drive.getFileContent(sortedFiles[0].id);
      return JSON.parse(content) as SessionSummary;
    } catch {
      return null;
    }
  }

  async listSummaries(): Promise<SessionSummary[]> {
    if (!this.summariesFolderId) await this.init();

    const files = await this.drive.listFiles(this.summariesFolderId!);
    const summaries: SessionSummary[] = [];

    for (const file of files) {
      if (file.name.endsWith('.json')) {
        try {
          const content = await this.drive.getFileContent(file.id);
          summaries.push(JSON.parse(content) as SessionSummary);
        } catch {
          // Skip invalid files
        }
      }
    }

    return summaries.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  // Custom prompts
  async getCustomPrompt(): Promise<string | null> {
    if (!this.studioraFolderId) await this.init();

    const files = await this.drive.listFiles(this.studioraFolderId!);
    const promptFile = files.find(f => f.name === 'prompts.md');

    if (promptFile) {
      return await this.drive.getFileContent(promptFile.id);
    }
    return null;
  }

  async saveCustomPrompt(prompt: string): Promise<void> {
    if (!this.studioraFolderId) await this.init();

    const files = await this.drive.listFiles(this.studioraFolderId!);
    const promptFile = files.find(f => f.name === 'prompts.md');

    if (promptFile) {
      await this.drive.updateFile(promptFile.id, prompt);
    } else {
      await this.drive.createFile('prompts.md', prompt, this.studioraFolderId!);
    }
  }

  // Calculate current context usage
  calculateContextUsage(
    messages: { role: string; content: string }[],
    provider: 'anthropic' | 'openai' | 'gemini'
  ): { used: number; max: number; percentage: number } {
    const totalTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    const maxTokens = CONTEXT_LIMITS[provider];

    return {
      used: totalTokens,
      max: maxTokens,
      percentage: totalTokens / maxTokens,
    };
  }
}
