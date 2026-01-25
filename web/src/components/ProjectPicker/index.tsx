import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  Folder,
  FolderOpen,
  Close,
  Refresh,
  AccessTime,
} from '@mui/icons-material';
import { useAppStore } from '../../stores/app-store';
import { GoogleDriveClient } from '../../lib/google-drive';

// Glass styling
const glassPanel = {
  background: 'rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: '24px',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
};

const glassButton = {
  background: 'rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '12px',
  color: 'white',
  px: 3,
  py: 1.5,
  fontSize: '0.9rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  '&:hover': {
    background: 'rgba(255, 255, 255, 0.2)',
    transform: 'translateY(-1px)',
  },
};

interface Project {
  id: string;
  name: string;
  modifiedTime: string;
  config?: {
    name: string;
    description?: string;
    framework?: string;
    styling?: string;
  };
}

interface Props {
  onSelect: (projectId: string, config: Project['config']) => void;
  onCancel: () => void;
}

export function ProjectPicker({ onSelect, onCancel }: Props) {
  const { googleAccessToken } = useAppStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = async () => {
    if (!googleAccessToken) {
      setError('Please connect Google Drive first');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const driveClient = new GoogleDriveClient(googleAccessToken);

      // Find Studiora folder
      const rootFolders = await driveClient.listFiles('root');
      const studioraFolder = rootFolders.find(
        f => f.name === 'Studiora' && f.mimeType === 'application/vnd.google-apps.folder'
      );

      if (!studioraFolder) {
        setProjects([]);
        setLoading(false);
        return;
      }

      // List project folders inside Studiora
      const projectFolders = await driveClient.listFiles(studioraFolder.id);
      const folders = projectFolders.filter(
        f => f.mimeType === 'application/vnd.google-apps.folder' && !f.name.startsWith('.')
      );

      // Load config for each project
      const projectsWithConfig: Project[] = [];

      for (const folder of folders) {
        const project: Project = {
          id: folder.id,
          name: folder.name,
          modifiedTime: folder.modifiedTime || new Date().toISOString(),
        };

        try {
          // Try to find .studiora/project.json
          const folderContents = await driveClient.listFiles(folder.id);
          const studioraConfigFolder = folderContents.find(
            f => f.name === '.studiora' && f.mimeType === 'application/vnd.google-apps.folder'
          );

          if (studioraConfigFolder) {
            const configFiles = await driveClient.listFiles(studioraConfigFolder.id);
            const configFile = configFiles.find(f => f.name === 'project.json');

            if (configFile) {
              const configContent = await driveClient.getFileContent(configFile.id);
              project.config = JSON.parse(configContent);
            }
          }
        } catch (e) {
          // Config not found, use defaults
          console.log(`No config for ${folder.name}`);
        }

        projectsWithConfig.push(project);
      }

      // Sort by modified time (most recent first)
      projectsWithConfig.sort((a, b) =>
        new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
      );

      setProjects(projectsWithConfig);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError('Failed to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [googleAccessToken]);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)} hours ago`;
    } else if (diffDays < 7) {
      return `${Math.floor(diffDays)} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <Box sx={{
      minHeight: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      p: 3,
      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 25%, #4c1d95 50%, #581c87 75%, #701a75 100%)',
    }}>
      <Box sx={{ ...glassPanel, maxWidth: 500, width: '100%', p: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <FolderOpen sx={{ fontSize: 28, color: '#a855f7' }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ color: 'white', fontSize: '1.5rem', fontWeight: 600 }}>
              Open Project
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
              Select a project from Google Drive
            </Typography>
          </Box>
          <IconButton onClick={loadProjects} sx={{ color: 'rgba(255,255,255,0.6)' }}>
            <Refresh />
          </IconButton>
          <IconButton onClick={onCancel} sx={{ color: 'rgba(255,255,255,0.6)' }}>
            <Close />
          </IconButton>
        </Box>

        {/* Content */}
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CircularProgress sx={{ color: 'rgba(139, 92, 246, 0.8)' }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', mt: 2 }}>
              Loading projects...
            </Typography>
          </Box>
        ) : error ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography sx={{ color: '#f87171', mb: 2 }}>
              {error}
            </Typography>
            <Box
              component="button"
              onClick={loadProjects}
              sx={glassButton}
            >
              Try Again
            </Box>
          </Box>
        ) : projects.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Folder sx={{ fontSize: 64, color: 'rgba(255,255,255,0.2)', mb: 2 }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', mb: 1 }}>
              No projects found
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>
              Create a new project to get started
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 400, overflow: 'auto' }}>
            {projects.map((project) => (
              <Box
                key={project.id}
                component="button"
                onClick={() => onSelect(project.id, project.config)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 2,
                  borderRadius: '14px',
                  bgcolor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  color: 'white',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.08)',
                    borderColor: 'rgba(139, 92, 246, 0.4)',
                    transform: 'translateX(4px)',
                  },
                }}
              >
                <Box sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(168, 85, 247, 0.2))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Folder sx={{ fontSize: 24, color: '#a855f7' }} />
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{
                    fontWeight: 500,
                    fontSize: '1rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {project.config?.name || project.name}
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <AccessTime sx={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }} />
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                      {formatTime(project.modifiedTime)}
                    </Typography>

                    {project.config?.framework && (
                      <>
                        <Box sx={{
                          width: 4,
                          height: 4,
                          borderRadius: '50%',
                          bgcolor: 'rgba(255,255,255,0.3)',
                        }} />
                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                          {project.config.framework}
                        </Typography>
                      </>
                    )}
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        )}

        {/* Footer */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3, pt: 3, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Box
            component="button"
            onClick={onCancel}
            sx={glassButton}
          >
            Cancel
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
