import { useEffect, useState } from 'react';
import {
  Folder,
  File,
  RefreshCw,
  Save,
  Plus,
  ArrowLeft,
  FileCode,
  FileText,
  FileJson,
} from 'lucide-react';
import { useAppStore } from '../stores/app-store';
import type { DriveFile } from '../lib/types';

function getFileIcon(file: DriveFile) {
  if (file.mimeType === 'application/vnd.google-apps.folder') {
    return <Folder className="w-4 h-4 text-yellow-400" />;
  }

  const name = file.name.toLowerCase();
  if (name.endsWith('.json')) {
    return <FileJson className="w-4 h-4 text-yellow-300" />;
  }
  if (name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.js') || name.endsWith('.jsx')) {
    return <FileCode className="w-4 h-4 text-blue-400" />;
  }
  if (name.endsWith('.md') || name.endsWith('.txt')) {
    return <FileText className="w-4 h-4 text-gray-400" />;
  }

  return <File className="w-4 h-4 text-gray-400" />;
}

export function FileExplorer() {
  const [editedContent, setEditedContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFileModal, setShowNewFileModal] = useState(false);

  const {
    googleAccessToken,
    driveProjectFolderId,
    currentFiles,
    selectedFile,
    fileContent,
    currentPath,
    loadDriveFiles,
    loadFileContent,
    saveFile,
    createFile,
  } = useAppStore();

  useEffect(() => {
    if (googleAccessToken && driveProjectFolderId) {
      loadDriveFiles();
    }
  }, [googleAccessToken, driveProjectFolderId]);

  useEffect(() => {
    setEditedContent(fileContent);
    setIsEditing(false);
  }, [fileContent]);

  const handleFileClick = async (file: DriveFile) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      await loadDriveFiles(file.id);
    } else {
      await loadFileContent(file);
    }
  };

  const handleSave = async () => {
    await saveFile(editedContent);
    setIsEditing(false);
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim()) return;
    await createFile(newFileName, '');
    setNewFileName('');
    setShowNewFileModal(false);
  };

  if (!googleAccessToken) {
    return (
      <div className="flex flex-col h-full bg-gray-900 items-center justify-center text-gray-400">
        <Folder className="w-12 h-12 mb-4" />
        <p>Connect Google Drive to access files</p>
      </div>
    );
  }

  if (!driveProjectFolderId) {
    return (
      <div className="flex flex-col h-full bg-gray-900 items-center justify-center text-gray-400">
        <Folder className="w-12 h-12 mb-4" />
        <p>Select a project folder in Settings</p>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-900">
      {/* File list */}
      <div className="w-64 border-r border-gray-800 flex flex-col">
        <div className="p-3 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Files</h3>
          <div className="flex gap-1">
            <button
              onClick={() => setShowNewFileModal(true)}
              className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
              title="New file"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => loadDriveFiles()}
              className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {currentPath.length > 0 && (
          <button
            onClick={() => loadDriveFiles(driveProjectFolderId)}
            className="flex items-center gap-2 p-2 text-gray-400 hover:text-white hover:bg-gray-800 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to root
          </button>
        )}

        <div className="flex-1 overflow-y-auto">
          {currentFiles.map((file) => (
            <button
              key={file.id}
              onClick={() => handleFileClick(file)}
              className={`w-full flex items-center gap-2 p-2 text-left text-sm hover:bg-gray-800 ${
                selectedFile?.id === file.id ? 'bg-gray-800 text-white' : 'text-gray-300'
              }`}
            >
              {getFileIcon(file)}
              <span className="truncate">{file.name}</span>
            </button>
          ))}

          {currentFiles.length === 0 && (
            <p className="p-4 text-gray-500 text-sm">No files in this folder</p>
          )}
        </div>
      </div>

      {/* File content */}
      <div className="flex-1 flex flex-col">
        {selectedFile ? (
          <>
            <div className="p-3 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getFileIcon(selectedFile)}
                <span className="text-white text-sm">{selectedFile.name}</span>
              </div>
              {isEditing && (
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              )}
            </div>
            <div className="flex-1 overflow-auto">
              <textarea
                value={editedContent}
                onChange={(e) => {
                  setEditedContent(e.target.value);
                  setIsEditing(true);
                }}
                className="w-full h-full bg-gray-900 text-gray-100 p-4 font-mono text-sm resize-none focus:outline-none"
                spellCheck={false}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <p>Select a file to view its contents</p>
          </div>
        )}
      </div>

      {/* New file modal */}
      {showNewFileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-white mb-4">Create New File</h3>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="filename.ts"
              className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowNewFileModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFile}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
