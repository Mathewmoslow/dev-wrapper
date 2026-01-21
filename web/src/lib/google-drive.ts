import type { DriveFile } from './types';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
].join(' ');

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

export class GoogleDriveClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${DRIVE_API}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Drive API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // List files in a folder
  async listFiles(folderId: string = 'root'): Promise<DriveFile[]> {
    const query = `'${folderId}' in parents and trashed = false`;
    const response = await this.request<{ files: DriveFile[] }>(
      `/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime,size,parents)`
    );
    return response.files;
  }

  // Get file content
  async getFileContent(fileId: string): Promise<string> {
    const response = await fetch(
      `${DRIVE_API}/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get file: ${response.status}`);
    }

    return response.text();
  }

  // Create a new file
  async createFile(
    name: string,
    content: string,
    parentId: string = 'root',
    mimeType: string = 'text/plain'
  ): Promise<DriveFile> {
    // First create metadata
    const metadata = {
      name,
      parents: [parentId],
      mimeType,
    };

    // Multipart upload
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const body =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n\r\n` +
      content +
      closeDelimiter;

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create file: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Update file content
  async updateFile(fileId: string, content: string): Promise<DriveFile> {
    const response = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,name,mimeType,modifiedTime`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'text/plain',
        },
        body: content,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update file: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Create folder
  async createFolder(name: string, parentId: string = 'root'): Promise<DriveFile> {
    return this.request<DriveFile>('/files', {
      method: 'POST',
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    });
  }

  // Delete file
  async deleteFile(fileId: string): Promise<void> {
    await fetch(`${DRIVE_API}/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  // Search files by name
  async searchFiles(query: string, folderId?: string): Promise<DriveFile[]> {
    let q = `name contains '${query}' and trashed = false`;
    if (folderId) {
      q += ` and '${folderId}' in parents`;
    }

    const response = await this.request<{ files: DriveFile[] }>(
      `/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,modifiedTime,size,parents)`
    );
    return response.files;
  }

  // Get file metadata
  async getFile(fileId: string): Promise<DriveFile> {
    return this.request<DriveFile>(
      `/files/${fileId}?fields=id,name,mimeType,modifiedTime,size,parents`
    );
  }
}

// OAuth flow helpers
export function getGoogleAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: GOOGLE_SCOPES,
    include_granted_scopes: 'true',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function parseGoogleAuthResponse(hash: string): { accessToken: string; expiresIn: number } | null {
  const params = new URLSearchParams(hash.replace('#', ''));
  const accessToken = params.get('access_token');
  const expiresIn = params.get('expires_in');

  if (accessToken && expiresIn) {
    return {
      accessToken,
      expiresIn: parseInt(expiresIn, 10),
    };
  }

  return null;
}
