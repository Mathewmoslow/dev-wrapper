import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Folder,
  InsertDriveFile,
  Refresh,
  Save,
  Add,
  ArrowBack,
  Code,
  Description,
  DataObject,
  GitHub,
  PlayArrow,
} from '@mui/icons-material';
import { CodePreview } from './CodePreview';
import { useAppStore } from '../stores/app-store';
import type { DriveFile } from '../lib/types';

function getFileIcon(file: DriveFile) {
  if (file.mimeType === 'application/vnd.google-apps.folder') {
    return <Folder sx={{ color: '#fbbf24' }} />;
  }

  const name = file.name.toLowerCase();
  if (name.endsWith('.json')) {
    return <DataObject sx={{ color: '#fcd34d' }} />;
  }
  if (name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.js') || name.endsWith('.jsx')) {
    return <Code sx={{ color: '#60a5fa' }} />;
  }
  if (name.endsWith('.md') || name.endsWith('.txt')) {
    return <Description sx={{ color: '#9ca3af' }} />;
  }

  return <InsertDriveFile sx={{ color: '#9ca3af' }} />;
}

export function FileExplorer() {
  const [editedContent, setEditedContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

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
    githubToken,
    githubRepo,
    commitFile,
    previewPanelOpen,
    openPreviewWithFile,
    detectPreviewMode,
    setPreviewFiles,
    previewState,
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

  const handleCommit = async () => {
    if (!selectedFile || !commitMessage.trim()) return;
    setIsCommitting(true);
    try {
      // Save file first if there are changes
      if (isEditing) {
        await saveFile(editedContent);
        setIsEditing(false);
      }
      // Commit to GitHub
      await commitFile(selectedFile.name, editedContent, commitMessage);
      setSnackbar({ open: true, message: `Committed "${selectedFile.name}" to GitHub`, severity: 'success' });
      setCommitMessage('');
      setShowCommitModal(false);
    } catch (error) {
      setSnackbar({ open: true, message: `Failed to commit: ${error}`, severity: 'error' });
    } finally {
      setIsCommitting(false);
    }
  };

  if (!googleAccessToken) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          bgcolor: 'background.default',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.secondary',
        }}
      >
        <Folder sx={{ fontSize: 48, mb: 2 }} />
        <Typography>Connect Google Drive to access files</Typography>
      </Box>
    );
  }

  if (!driveProjectFolderId) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          bgcolor: 'background.default',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.secondary',
        }}
      >
        <Folder sx={{ fontSize: 48, mb: 2 }} />
        <Typography>Select a project folder in Settings</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', bgcolor: 'background.default', overflow: 'hidden' }}>
      {/* File list */}
      <Box
        sx={{
          width: 256,
          borderRight: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box
          sx={{
            p: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Files
          </Typography>
          <Box>
            <IconButton
              size="small"
              onClick={() => setShowNewFileModal(true)}
              title="New file"
            >
              <Add fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => loadDriveFiles()}
              title="Refresh"
            >
              <Refresh fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {currentPath.length > 0 && (
          <ListItemButton
            onClick={() => loadDriveFiles(driveProjectFolderId)}
            sx={{ py: 1 }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <ArrowBack fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Back to root"
              primaryTypographyProps={{ variant: 'body2' }}
            />
          </ListItemButton>
        )}

        <List sx={{ flex: 1, overflow: 'auto', p: 0 }}>
          {currentFiles.map((file) => (
            <ListItem key={file.id} disablePadding>
              <ListItemButton
                onClick={() => handleFileClick(file)}
                selected={selectedFile?.id === file.id}
                sx={{ py: 0.75 }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {getFileIcon(file)}
                </ListItemIcon>
                <ListItemText
                  primary={file.name}
                  primaryTypographyProps={{
                    variant: 'body2',
                    noWrap: true,
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}

          {currentFiles.length === 0 && (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                No files in this folder
              </Typography>
            </Box>
          )}
        </List>
      </Box>

      {/* File content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 300 }}>
        {selectedFile ? (
          <>
            <Box
              sx={{
                p: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {getFileIcon(selectedFile)}
                <Typography variant="body2">{selectedFile.name}</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {isEditing && (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSave}
                  >
                    Save
                  </Button>
                )}
                {selectedFile && detectPreviewMode(selectedFile.name) !== 'none' && (
                  <Button
                    size="small"
                    variant={previewPanelOpen ? 'contained' : 'outlined'}
                    color={previewPanelOpen ? 'secondary' : 'primary'}
                    startIcon={<PlayArrow />}
                    onClick={() => openPreviewWithFile(selectedFile.name, editedContent)}
                  >
                    Preview
                  </Button>
                )}
                {githubToken && githubRepo && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<GitHub />}
                    onClick={() => setShowCommitModal(true)}
                  >
                    Commit
                  </Button>
                )}
              </Box>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              <TextField
                multiline
                fullWidth
                value={editedContent}
                onChange={(e) => {
                  const newContent = e.target.value;
                  setEditedContent(newContent);
                  setIsEditing(true);
                  // Update preview if open
                  if (previewPanelOpen && selectedFile) {
                    setPreviewFiles({ ...previewState.files, [selectedFile.name]: newContent });
                  }
                }}
                sx={{
                  height: '100%',
                  '& .MuiOutlinedInput-root': {
                    height: '100%',
                    alignItems: 'flex-start',
                    borderRadius: 0,
                    '& fieldset': { border: 'none' },
                  },
                  '& .MuiInputBase-input': {
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    p: 2,
                  },
                }}
                InputProps={{
                  spellCheck: false,
                }}
              />
            </Box>
          </>
        ) : (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.secondary',
            }}
          >
            <Typography>Select a file to view its contents</Typography>
          </Box>
        )}
      </Box>

      {/* Code Preview Panel */}
      <CodePreview />

      {/* New file modal */}
      <Dialog
        open={showNewFileModal}
        onClose={() => setShowNewFileModal(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Create New File</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="filename.ts"
            size="small"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNewFileModal(false)}>Cancel</Button>
          <Button onClick={handleCreateFile} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Commit modal */}
      <Dialog
        open={showCommitModal}
        onClose={() => setShowCommitModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Commit to GitHub</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Committing: {selectedFile?.name} to {githubRepo}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Enter commit message..."
            size="small"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCommitModal(false)} disabled={isCommitting}>
            Cancel
          </Button>
          <Button
            onClick={handleCommit}
            variant="contained"
            disabled={isCommitting || !commitMessage.trim()}
          >
            {isCommitting ? 'Committing...' : 'Commit'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
