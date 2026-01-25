import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  Divider,
  Backdrop,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Chat as ChatIcon,
  FolderOpen,
  Terminal,
  Settings,
  Logout,
  Menu,
  Add,
  Code,
  Close,
} from '@mui/icons-material';
import { useAppStore } from '../stores/app-store';

const drawerWidth = 240;
const collapsedWidth = 64;

export function Sidebar() {
  const theme = useTheme();
  const { view, setView, sidebarOpen, toggleSidebar, googleAccessToken, githubToken } = useAppStore();

  // Detect landscape mode with short height (mobile landscape)
  const isShortViewport = useMediaQuery('(max-height: 500px)');
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const navItems = [
    { id: 'workspace' as const, icon: <Code />, label: 'Workspace' },
    { id: 'chat' as const, icon: <ChatIcon />, label: 'Chat' },
    { id: 'files' as const, icon: <FolderOpen />, label: 'Files' },
    { id: 'terminal' as const, icon: <Terminal />, label: 'Terminal' },
    { id: 'init' as const, icon: <Add />, label: 'New Project' },
    { id: 'settings' as const, icon: <Settings />, label: 'Settings' },
  ];

  const handleNavClick = (id: typeof navItems[number]['id']) => {
    setView(id);
    // Auto-close sidebar on mobile after selection
    if (isMobile) {
      toggleSidebar();
    }
  };

  return (
    <>
      {/* Mobile menu button */}
      <IconButton
        onClick={toggleSidebar}
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          top: 8,
          left: 8,
          zIndex: 1300,
          bgcolor: 'background.paper',
          width: 44,
          height: 44,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Menu />
      </IconButton>

      {/* Sidebar */}
      <Box
        component="nav"
        sx={{
          width: { xs: sidebarOpen ? drawerWidth : 0, md: sidebarOpen ? drawerWidth : collapsedWidth },
          flexShrink: 0,
          transition: 'width 0.3s',
        }}
      >
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={sidebarOpen}
          onClose={toggleSidebar}
          sx={{
            '& .MuiDrawer-paper': {
              width: { xs: drawerWidth, md: sidebarOpen ? drawerWidth : collapsedWidth },
              boxSizing: 'border-box',
              bgcolor: '#0a0a0a',
              borderRight: '1px solid',
              borderColor: 'divider',
              transition: 'width 0.3s',
              overflowX: 'hidden',
              overflowY: 'auto', // Enable vertical scrolling
            },
          }}
        >
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100%',
            height: 'auto',
          }}>
            {/* Logo - compact on short viewports */}
            <Box sx={{
              p: isShortViewport ? 1 : 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    width: isShortViewport ? 28 : 32,
                    height: isShortViewport ? 28 : 32,
                    background: 'linear-gradient(135deg, #3b82f6, #9333ea)',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold', fontSize: isShortViewport ? '0.75rem' : '0.875rem' }}>
                    S
                  </Typography>
                </Box>
                {sidebarOpen && (
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'white', lineHeight: 1.2, fontSize: isShortViewport ? '0.875rem' : '1rem' }}>
                      Studiora
                    </Typography>
                    {!isShortViewport && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Web Edition
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
              {/* Close button on mobile */}
              {isMobile && sidebarOpen && (
                <IconButton onClick={toggleSidebar} size="small" sx={{ color: 'text.secondary' }}>
                  <Close />
                </IconButton>
              )}
            </Box>

            {/* Nav Items - scrollable */}
            <List sx={{
              flex: 1,
              p: isShortViewport ? 0.5 : 1,
              overflowY: 'auto',
              minHeight: 0,
            }}>
              {navItems.map((item) => {
                const isActive = view === item.id;

                return (
                  <ListItem key={item.id} disablePadding sx={{ mb: isShortViewport ? 0 : 0.5 }}>
                    <ListItemButton
                      onClick={() => handleNavClick(item.id)}
                      selected={isActive}
                      sx={{
                        borderRadius: 1,
                        minHeight: isShortViewport ? 36 : 44, // Touch-friendly but compact on landscape
                        justifyContent: sidebarOpen ? 'initial' : 'center',
                        px: sidebarOpen ? 2 : 1,
                        py: isShortViewport ? 0.5 : 1,
                        '&.Mui-selected': {
                          bgcolor: 'action.selected',
                        },
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 0,
                          mr: sidebarOpen ? 2 : 'auto',
                          justifyContent: 'center',
                          color: isActive ? 'primary.main' : 'text.secondary',
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      {sidebarOpen && (
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{
                            variant: 'body2',
                            color: isActive ? 'white' : 'text.secondary',
                            fontSize: isShortViewport ? '0.8rem' : '0.875rem',
                          }}
                        />
                      )}
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>

            {/* Connection Status - hide on very short viewports */}
            {!isShortViewport && (
              <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
                {sidebarOpen ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        Google Drive
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: googleAccessToken ? 'success.main' : 'error.main' }}
                      >
                        {googleAccessToken ? 'Connected' : 'Not connected'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        GitHub
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: githubToken ? 'success.main' : 'error.main' }}
                      >
                        {githubToken ? 'Connected' : 'Not connected'}
                      </Typography>
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: googleAccessToken ? 'success.main' : 'error.main',
                      }}
                      title={`Google Drive: ${googleAccessToken ? 'Connected' : 'Not connected'}`}
                    />
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: githubToken ? 'success.main' : 'error.main',
                      }}
                      title={`GitHub: ${githubToken ? 'Connected' : 'Not connected'}`}
                    />
                  </Box>
                )}
              </Box>
            )}

            {/* Auth button - compact on short viewports */}
            <Divider />
            <List sx={{ p: isShortViewport ? 0.5 : 1, flexShrink: 0 }}>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavClick('auth' as any)}
                  sx={{
                    borderRadius: 1,
                    minHeight: isShortViewport ? 36 : 44,
                    justifyContent: sidebarOpen ? 'initial' : 'center',
                    px: sidebarOpen ? 2 : 1,
                    py: isShortViewport ? 0.5 : 1,
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: sidebarOpen ? 2 : 'auto',
                      justifyContent: 'center',
                      color: 'text.secondary',
                    }}
                  >
                    <Logout />
                  </ListItemIcon>
                  {sidebarOpen && (
                    <ListItemText
                      primary="Connections"
                      primaryTypographyProps={{
                        variant: 'body2',
                        color: 'text.secondary',
                        fontSize: isShortViewport ? '0.8rem' : '0.875rem',
                      }}
                    />
                  )}
                </ListItemButton>
              </ListItem>
            </List>

            {/* Show compact connection status on short viewports */}
            {isShortViewport && sidebarOpen && (
              <Box sx={{
                px: 2,
                pb: 1,
                display: 'flex',
                gap: 2,
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: googleAccessToken ? 'success.main' : 'error.main',
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                    Drive
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: githubToken ? 'success.main' : 'error.main',
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                    GitHub
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </Drawer>
      </Box>

      {/* Overlay for mobile - using Backdrop as fallback for permanent drawer */}
      {isMobile && (
        <Backdrop
          open={sidebarOpen}
          onClick={toggleSidebar}
          sx={{
            zIndex: 1200,
          }}
        />
      )}
    </>
  );
}
