import { useEffect } from 'react';
import { FolderOpen, Github, Check, ExternalLink } from 'lucide-react';
import { useAppStore } from '../stores/app-store';
import { getGoogleAuthUrl, parseGoogleAuthResponse } from '../lib/google-drive';

export function Auth() {
  const {
    googleAccessToken,
    githubToken,
    setGoogleToken,
    setGithubToken,
    setView,
  } = useAppStore();

  // Handle OAuth callback
  useEffect(() => {
    if (window.location.hash) {
      const authResult = parseGoogleAuthResponse(window.location.hash);
      if (authResult) {
        setGoogleToken(authResult.accessToken);
        // Clear the hash
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

  const handleGoogleAuth = () => {
    const redirectUri = window.location.origin + window.location.pathname;
    window.location.href = getGoogleAuthUrl(redirectUri);
  };

  const handleGitHubTokenInput = () => {
    const token = prompt(
      'Enter your GitHub Personal Access Token:\n\n' +
      'Create one at: https://github.com/settings/tokens\n' +
      'Required scopes: repo, user'
    );
    if (token) {
      setGithubToken(token);
    }
  };

  const isReady = googleAccessToken && githubToken;

  return (
    <div className="h-full bg-gray-900 flex items-center justify-center">
      <div className="max-w-md w-full p-6 space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Studiora Web</h1>
          <p className="text-gray-400">
            AI-powered development from anywhere
          </p>
        </div>

        <div className="space-y-4">
          {/* Google Drive Connection */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-700 rounded-lg">
                  <FolderOpen className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">Google Drive</h3>
                  <p className="text-sm text-gray-400">File storage & sync</p>
                </div>
              </div>
              {googleAccessToken && (
                <Check className="w-5 h-5 text-green-400" />
              )}
            </div>

            {googleAccessToken ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-400">Connected</span>
                <button
                  onClick={() => setGoogleToken('')}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleAuth}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Connect Google Drive
              </button>
            )}
          </div>

          {/* GitHub Connection */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-700 rounded-lg">
                  <Github className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-white">GitHub</h3>
                  <p className="text-sm text-gray-400">Git operations & repos</p>
                </div>
              </div>
              {githubToken && (
                <Check className="w-5 h-5 text-green-400" />
              )}
            </div>

            {githubToken ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-400">Connected</span>
                <button
                  onClick={() => setGithubToken('')}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={handleGitHubTokenInput}
                  className="w-full py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm font-medium mb-2"
                >
                  Enter Personal Access Token
                </button>
                <a
                  href="https://github.com/settings/tokens/new?description=Studiora%20Web&scopes=repo,user"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 text-sm text-gray-400 hover:text-white"
                >
                  Create a token <ExternalLink className="w-3 h-3" />
                </a>
              </>
            )}
          </div>
        </div>

        {/* Continue Button */}
        {isReady && (
          <button
            onClick={() => setView('chat')}
            className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            Continue to Chat
          </button>
        )}

        {/* Info */}
        <div className="text-center text-sm text-gray-500">
          <p>Your credentials are stored locally in your browser.</p>
          <p>Nothing is sent to external servers except the AI providers.</p>
        </div>

        {/* Skip for now */}
        {!isReady && (
          <button
            onClick={() => setView('settings')}
            className="w-full py-2 text-gray-400 hover:text-white text-sm"
          >
            Skip for now (limited features)
          </button>
        )}
      </div>
    </div>
  );
}
