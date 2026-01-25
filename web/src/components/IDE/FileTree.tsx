import { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Collapse,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
} from '@mui/material';
import {
  Folder,
  FolderOpen,
  InsertDriveFile,
  Add,
  CreateNewFolder,
  Refresh,
  ExpandMore,
  ChevronRight,
  Javascript,
  Code,
  DataObject,
  Css,
  Html,
} from '@mui/icons-material';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

interface FileTreeProps {
  files: string[];
  onFileSelect: (path: string) => void;
  onCreateFile: (path: string) => void;
  onCreateFolder: (path: string) => void;
  onRefresh: () => void;
  selectedFile?: string;
}

// Convert flat file list to tree structure
function buildTree(files: string[]): FileNode[] {
  const result: FileNode[] = [];
  const folderMap: Record<string, FileNode> = {};

  // Sort files to process folders first
  const sortedFiles = [...files].sort();

  for (const filePath of sortedFiles) {
    const parts = filePath.split('/');

    if (parts.length === 1) {
      // Root-level file
      result.push({ name: parts[0], path: filePath, type: 'file' });
    } else {
      // File in folder - ensure all parent folders exist
      let currentPath = '';
      let currentChildren = result;

      for (let i = 0; i < parts.length - 1; i++) {
        const folderName = parts[i];
        currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;

        if (!folderMap[currentPath]) {
          const newFolder: FileNode = {
            name: folderName,
            path: currentPath,
            type: 'folder',
            children: [],
          };
          folderMap[currentPath] = newFolder;
          currentChildren.push(newFolder);
        }

        currentChildren = folderMap[currentPath].children!;
      }

      // Add the file to its parent folder
      currentChildren.push({
        name: parts[parts.length - 1],
        path: filePath,
        type: 'file',
      });
    }
  }

  // Sort: folders first, then files, alphabetically
  const sortNodes = (nodes: FileNode[]): FileNode[] => {
    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    }).map(node => {
      if (node.children) {
        node.children = sortNodes(node.children);
      }
      return node;
    });
  };

  return sortNodes(result);
}

// Get icon for file type
function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
      return <Javascript sx={{ color: '#f7df1e', fontSize: 18 }} />;
    case 'ts':
    case 'tsx':
      return <Code sx={{ color: '#3178c6', fontSize: 18 }} />;
    case 'json':
      return <DataObject sx={{ color: '#cbcb41', fontSize: 18 }} />;
    case 'css':
      return <Css sx={{ color: '#264de4', fontSize: 18 }} />;
    case 'html':
      return <Html sx={{ color: '#e34c26', fontSize: 18 }} />;
    default:
      return <InsertDriveFile sx={{ color: 'text.secondary', fontSize: 18 }} />;
  }
}

function TreeNode({
  node,
  depth,
  onSelect,
  selectedFile,
}: {
  node: FileNode;
  depth: number;
  onSelect: (path: string) => void;
  selectedFile?: string;
}) {
  const [open, setOpen] = useState(depth < 2);

  const handleClick = () => {
    if (node.type === 'folder') {
      setOpen(!open);
    } else {
      onSelect(node.path);
    }
  };

  const isSelected = selectedFile === node.path;

  return (
    <>
      <ListItemButton
        onClick={handleClick}
        selected={isSelected}
        sx={{
          py: 0.25,
          pl: 1 + depth * 1.5,
          minHeight: 28,
          '&.Mui-selected': {
            bgcolor: 'action.selected',
          },
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 24 }}>
          {node.type === 'folder' ? (
            open ? <FolderOpen sx={{ color: '#dcb67a', fontSize: 18 }} /> : <Folder sx={{ color: '#dcb67a', fontSize: 18 }} />
          ) : (
            getFileIcon(node.name)
          )}
        </ListItemIcon>
        {node.type === 'folder' && (
          <Box sx={{ mr: 0.5, display: 'flex', alignItems: 'center' }}>
            {open ? <ExpandMore sx={{ fontSize: 16 }} /> : <ChevronRight sx={{ fontSize: 16 }} />}
          </Box>
        )}
        <ListItemText
          primary={node.name}
          primaryTypographyProps={{
            fontSize: 13,
            fontFamily: 'system-ui',
            noWrap: true,
          }}
        />
      </ListItemButton>
      {node.type === 'folder' && node.children && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List disablePadding>
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                onSelect={onSelect}
                selectedFile={selectedFile}
              />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
}

export function FileTree({
  files,
  onFileSelect,
  onCreateFile,
  onCreateFolder,
  onRefresh,
  selectedFile,
}: FileTreeProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [newItemType, setNewItemType] = useState<'file' | 'folder' | null>(null);
  const [newItemName, setNewItemName] = useState('');

  const tree = buildTree(files);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleCreateItem = () => {
    if (!newItemName.trim()) return;

    if (newItemType === 'file') {
      onCreateFile(newItemName.trim());
    } else if (newItemType === 'folder') {
      onCreateFolder(newItemName.trim());
    }

    setNewItemType(null);
    setNewItemName('');
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#181818',
        borderRight: '1px solid',
        borderColor: 'divider',
      }}
      onContextMenu={handleContextMenu}
    >
      {/* Header */}
      <Box sx={{
        px: 1,
        py: 0.75,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}>
        <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Explorer
        </Typography>
        <Box>
          <Tooltip title="New File">
            <IconButton size="small" onClick={() => setNewItemType('file')}>
              <Add sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="New Folder">
            <IconButton size="small" onClick={() => setNewItemType('folder')}>
              <CreateNewFolder sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={onRefresh}>
              <Refresh sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* New item input */}
      {newItemType && (
        <Box sx={{ px: 1, py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField
            autoFocus
            size="small"
            placeholder={newItemType === 'file' ? 'filename.tsx' : 'folder-name'}
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateItem();
              if (e.key === 'Escape') {
                setNewItemType(null);
                setNewItemName('');
              }
            }}
            onBlur={() => {
              if (newItemName.trim()) handleCreateItem();
              else {
                setNewItemType(null);
                setNewItemName('');
              }
            }}
            fullWidth
            sx={{
              '& .MuiInputBase-input': { fontSize: 12, py: 0.5 },
            }}
          />
        </Box>
      )}

      {/* File tree */}
      <List
        dense
        disablePadding
        sx={{
          flex: 1,
          overflow: 'auto',
          '&::-webkit-scrollbar': { width: 8 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'action.hover', borderRadius: 1 },
        }}
      >
        {tree.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              No files yet
            </Typography>
          </Box>
        ) : (
          tree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              onSelect={onFileSelect}
              selectedFile={selectedFile}
            />
          ))
        )}
      </List>

      {/* Context menu */}
      <Menu
        open={Boolean(contextMenu)}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.y, left: contextMenu.x } : undefined}
      >
        <MenuItem onClick={() => { setNewItemType('file'); setContextMenu(null); }}>
          <Add sx={{ fontSize: 16, mr: 1 }} /> New File
        </MenuItem>
        <MenuItem onClick={() => { setNewItemType('folder'); setContextMenu(null); }}>
          <CreateNewFolder sx={{ fontSize: 16, mr: 1 }} /> New Folder
        </MenuItem>
        <MenuItem onClick={() => { onRefresh(); setContextMenu(null); }}>
          <Refresh sx={{ fontSize: 16, mr: 1 }} /> Refresh
        </MenuItem>
      </Menu>
    </Box>
  );
}
