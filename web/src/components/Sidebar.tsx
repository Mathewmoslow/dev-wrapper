import { MessageSquare, FolderOpen, Settings, LogOut, Menu } from 'lucide-react';
import { useAppStore } from '../stores/app-store';

export function Sidebar() {
  const { view, setView, sidebarOpen, toggleSidebar, googleAccessToken, githubToken } = useAppStore();

  const navItems = [
    { id: 'chat' as const, icon: MessageSquare, label: 'Chat' },
    { id: 'files' as const, icon: FolderOpen, label: 'Files' },
    { id: 'settings' as const, icon: Settings, label: 'Settings' },
  ];

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={toggleSidebar}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-gray-800 rounded-lg text-white"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Sidebar */}
      <div
        className={`fixed md:relative z-40 h-full bg-gray-950 border-r border-gray-800 transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-0 md:w-16'
        } overflow-hidden`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              {sidebarOpen && (
                <div>
                  <h1 className="font-semibold text-white">Studiora</h1>
                  <p className="text-xs text-gray-500">Web Edition</p>
                </div>
              )}
            </div>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 p-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = view === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && <span className="text-sm">{item.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* Connection Status */}
          <div className="p-4 border-t border-gray-800">
            {sidebarOpen ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Google Drive</span>
                  <span className={googleAccessToken ? 'text-green-400' : 'text-red-400'}>
                    {googleAccessToken ? 'Connected' : 'Not connected'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">GitHub</span>
                  <span className={githubToken ? 'text-green-400' : 'text-red-400'}>
                    {githubToken ? 'Connected' : 'Not connected'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    googleAccessToken ? 'bg-green-400' : 'bg-red-400'
                  }`}
                  title={`Google Drive: ${googleAccessToken ? 'Connected' : 'Not connected'}`}
                />
                <div
                  className={`w-2 h-2 rounded-full ${
                    githubToken ? 'bg-green-400' : 'bg-red-400'
                  }`}
                  title={`GitHub: ${githubToken ? 'Connected' : 'Not connected'}`}
                />
              </div>
            )}
          </div>

          {/* Auth button */}
          <div className="p-2 border-t border-gray-800">
            <button
              onClick={() => setView('auth')}
              className="w-full flex items-center gap-3 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span className="text-sm">Connections</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={toggleSidebar}
        />
      )}
    </>
  );
}
