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
} from '@mui/material';
import {
  Chat as ChatIcon,
  FolderOpen,
  Settings,
  Logout,
  Menu,
  Add,
} from '@mui/icons-material';
import { useAppStore } from '../stores/app-store';

const drawerWidth = 240;
const collapsedWidth = 64;

export function Sidebar() {
  const { view, setView, sidebarOpen, toggleSidebar, googleAccessToken, githubToken } = useAppStore();

  const navItems = [
    { id: 'chat' as const, icon: <ChatIcon />, label: 'Chat' },
    { id: 'files' as const, icon: <FolderOpen />, label: 'Files' },
    { id: 'init' as const, icon: <Add />, label: 'New Project' },
    { id: 'settings' as const, icon: <Settings />, label: 'Settings' },
  ];

  return (
    <>
      {/* Mobile menu button */}
      <IconButton
        onClick={toggleSidebar}
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 1300,
          bgcolor: 'background.paper',
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
          variant="permanent"
          sx={{
            '& .MuiDrawer-paper': {
              width: { xs: sidebarOpen ? drawerWidth : 0, md: sidebarOpen ? drawerWidth : collapsedWidth },
              boxSizing: 'border-box',
              bgcolor: '#0a0a0a',
              borderRight: '1px solid',
              borderColor: 'divider',
              transition: 'width 0.3s',
              overflowX: 'hidden',
            },
          }}
          open={sidebarOpen}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Logo */}
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    background: 'linear-gradient(135deg, #3b82f6, #9333ea)',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold' }}>
                    S
                  </Typography>
                </Box>
                {sidebarOpen && (
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'white', lineHeight: 1.2 }}>
                      Studiora
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Web Edition
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Nav Items */}
            <List sx={{ flex: 1, p: 1 }}>
              {navItems.map((item) => {
                const isActive = view === item.id;

                return (
                  <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      onClick={() => setView(item.id)}
                      selected={isActive}
                      sx={{
                        borderRadius: 1,
                        minHeight: 40,
                        justifyContent: sidebarOpen ? 'initial' : 'center',
                        px: sidebarOpen ? 2 : 1,
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
                          }}
                        />
                      )}
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>

            {/* Connection Status */}
            <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
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

            {/* Auth button */}
            <Divider />
            <List sx={{ p: 1 }}>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => setView('auth')}
                  sx={{
                    borderRadius: 1,
                    minHeight: 40,
                    justifyContent: sidebarOpen ? 'initial' : 'center',
                    px: sidebarOpen ? 2 : 1,
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
                      }}
                    />
                  )}
                </ListItemButton>
              </ListItem>
            </List>
          </Box>
        </Drawer>
      </Box>

      {/* Overlay for mobile */}
      <Backdrop
        open={sidebarOpen}
        onClick={toggleSidebar}
        sx={{
          display: { xs: 'block', md: 'none' },
          zIndex: 1200,
        }}
      />
    </>
  );
}
