import { useEffect } from 'react';
import { useAppStore } from './stores/app-store';
import { Sidebar } from './components/Sidebar';
import { Chat } from './components/Chat';
import { FileExplorer } from './components/FileExplorer';
import { Settings } from './components/Settings';
import { Auth } from './components/Auth';

function App() {
  const { view, checkAllProviders, googleAccessToken, githubToken } = useAppStore();

  useEffect(() => {
    // Check provider health on mount
    checkAllProviders();
  }, []);

  // If not authenticated, show auth view
  const showAuth = view === 'auth' || (!googleAccessToken && !githubToken);

  if (showAuth) {
    return <Auth />;
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        {view === 'chat' && <Chat />}
        {view === 'files' && <FileExplorer />}
        {view === 'settings' && <Settings />}
      </main>
    </div>
  );
}

export default App;
