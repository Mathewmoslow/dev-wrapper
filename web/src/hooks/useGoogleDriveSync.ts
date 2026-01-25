import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleDriveClient } from '../lib/google-drive';
import { useAppStore } from '../stores/app-store';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

interface UseGoogleDriveSyncOptions {
  writeToContainer: (path: string, content: string) => Promise<void>;
  onLog?: (message: string, color?: 'green' | 'yellow' | 'red' | 'cyan') => void;
}

interface UseGoogleDriveSyncReturn {
  syncStatus: SyncStatus;
  driveFileIds: Record<string, string>;
  loadFromDrive: () => Promise<void>;
  saveFileToDrive: (path: string, content: string) => Promise<void>;
  isConnected: boolean;
}

export function useGoogleDriveSync(options: UseGoogleDriveSyncOptions): UseGoogleDriveSyncReturn {
  const { writeToContainer, onLog } = options;

  const { googleAccessToken, driveProjectFolderId, setGoogleToken } = useAppStore();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [driveFileIds, setDriveFileIds] = useState<Record<string, string>>({});

  const driveClientRef = useRef<GoogleDriveClient | null>(null);

  // Initialize Google Drive client
  useEffect(() => {
    if (googleAccessToken) {
      driveClientRef.current = new GoogleDriveClient(googleAccessToken);
    } else {
      driveClientRef.current = null;
    }
  }, [googleAccessToken]);

  const isConnected = Boolean(googleAccessToken && driveProjectFolderId);

  const log = useCallback((message: string, color?: 'green' | 'yellow' | 'red' | 'cyan') => {
    onLog?.(message, color);
  }, [onLog]);

  // Load files from Google Drive into WebContainer
  const loadFromDrive = useCallback(async () => {
    if (!driveClientRef.current || !driveProjectFolderId) {
      log('No Google Drive project connected', 'yellow');
      return;
    }

    setSyncStatus('syncing');
    log('Loading files from Google Drive...', 'cyan');

    try {
      const files = await driveClientRef.current.listFiles(driveProjectFolderId);
      const fileIdMap: Record<string, string> = {};
      let loadedCount = 0;

      for (const file of files) {
        // Skip folders and .studiora config
        if (file.mimeType === 'application/vnd.google-apps.folder') continue;
        if (file.name.startsWith('.studiora')) continue;

        try {
          const content = await driveClientRef.current.getFileContent(file.id);
          await writeToContainer(file.name, content);
          fileIdMap[file.name] = file.id;
          loadedCount++;
        } catch (err) {
          console.error(`Failed to load ${file.name}:`, err);
        }
      }

      setDriveFileIds(fileIdMap);
      setSyncStatus('synced');
      log(`Loaded ${loadedCount} files from Google Drive`, 'green');
    } catch (err) {
      console.error('Failed to load from Drive:', err);
      setSyncStatus('error');

      const errorMessage = String(err);
      if (errorMessage.includes('401')) {
        log('Google token expired. Please reconnect.', 'red');
        setGoogleToken('');
      } else {
        log('Failed to load from Google Drive', 'red');
      }
    }
  }, [driveProjectFolderId, writeToContainer, log, setGoogleToken]);

  // Save a single file to Google Drive
  const saveFileToDrive = useCallback(async (path: string, content: string) => {
    if (!driveClientRef.current || !driveProjectFolderId) {
      return; // Not connected, skip silently
    }

    try {
      const existingFileId = driveFileIds[path];
      if (existingFileId) {
        // Update existing file
        await driveClientRef.current.updateFile(existingFileId, content);
      } else {
        // Create new file
        const newFile = await driveClientRef.current.createFile(path, content, driveProjectFolderId);
        setDriveFileIds(prev => ({ ...prev, [path]: newFile.id }));
      }
      log(`Wrote: ${path} (synced to Drive)`, 'green');
    } catch (err) {
      console.error('Failed to sync to Drive:', err);
      const errorMessage = String(err);
      if (errorMessage.includes('401')) {
        log(`Wrote: ${path} (Google token expired)`, 'red');
        setGoogleToken('');
      } else {
        log(`Wrote: ${path} (Drive sync failed)`, 'yellow');
      }
    }
  }, [driveProjectFolderId, driveFileIds, log, setGoogleToken]);

  return {
    syncStatus,
    driveFileIds,
    loadFromDrive,
    saveFileToDrive,
    isConnected,
  };
}
