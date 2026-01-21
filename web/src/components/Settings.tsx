import { useState, useEffect } from 'react';
import { Key, FolderOpen, Github, RefreshCw, Check, X } from 'lucide-react';
import { useAppStore } from '../stores/app-store';

export function Settings() {
  const {
    anthropicKey,
    openaiKey,
    geminiKey,
    googleAccessToken,
    githubToken,
    driveProjectFolderId,
    githubRepo,
    repos,
    providerHealth,
    setApiKey,
    setDriveFolder,
    setGithubRepo,
    checkAllProviders,
    loadGithubRepos,
  } = useAppStore();

  const [localKeys, setLocalKeys] = useState({
    anthropic: anthropicKey,
    openai: openaiKey,
    gemini: geminiKey,
    driveFolderId: driveProjectFolderId,
  });

  useEffect(() => {
    if (githubToken) {
      loadGithubRepos();
    }
  }, [githubToken]);

  const handleSaveKey = (provider: 'anthropic' | 'openai' | 'gemini') => {
    setApiKey(provider, localKeys[provider]);
  };

  const handleSaveDriveFolder = () => {
    setDriveFolder(localKeys.driveFolderId);
  };

  return (
    <div className="h-full bg-gray-900 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        <h2 className="text-2xl font-bold text-white">Settings</h2>

        {/* AI Provider Keys */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Key className="w-5 h-5" />
              AI Provider API Keys
            </h3>
            <button
              onClick={checkAllProviders}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
              Check All
            </button>
          </div>

          {/* Anthropic */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">Anthropic (Claude)</label>
              {providerHealth.anthropic && (
                <span
                  className={`text-xs flex items-center gap-1 ${
                    providerHealth.anthropic.status === 'green'
                      ? 'text-green-400'
                      : providerHealth.anthropic.status === 'yellow'
                      ? 'text-yellow-400'
                      : 'text-red-400'
                  }`}
                >
                  {providerHealth.anthropic.status === 'green' ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <X className="w-3 h-3" />
                  )}
                  {providerHealth.anthropic.message}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={localKeys.anthropic}
                onChange={(e) => setLocalKeys({ ...localKeys, anthropic: e.target.value })}
                placeholder="sk-ant-..."
                className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
              />
              <button
                onClick={() => handleSaveKey('anthropic')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Save
              </button>
            </div>
          </div>

          {/* OpenAI */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">OpenAI (GPT)</label>
              {providerHealth.openai && (
                <span
                  className={`text-xs flex items-center gap-1 ${
                    providerHealth.openai.status === 'green'
                      ? 'text-green-400'
                      : providerHealth.openai.status === 'yellow'
                      ? 'text-yellow-400'
                      : 'text-red-400'
                  }`}
                >
                  {providerHealth.openai.status === 'green' ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <X className="w-3 h-3" />
                  )}
                  {providerHealth.openai.message}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={localKeys.openai}
                onChange={(e) => setLocalKeys({ ...localKeys, openai: e.target.value })}
                placeholder="sk-..."
                className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
              />
              <button
                onClick={() => handleSaveKey('openai')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Save
              </button>
            </div>
          </div>

          {/* Gemini */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">Google (Gemini)</label>
              {providerHealth.gemini && (
                <span
                  className={`text-xs flex items-center gap-1 ${
                    providerHealth.gemini.status === 'green'
                      ? 'text-green-400'
                      : providerHealth.gemini.status === 'yellow'
                      ? 'text-yellow-400'
                      : 'text-red-400'
                  }`}
                >
                  {providerHealth.gemini.status === 'green' ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <X className="w-3 h-3" />
                  )}
                  {providerHealth.gemini.message}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={localKeys.gemini}
                onChange={(e) => setLocalKeys({ ...localKeys, gemini: e.target.value })}
                placeholder="AI..."
                className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
              />
              <button
                onClick={() => handleSaveKey('gemini')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Save
              </button>
            </div>
          </div>
        </section>

        {/* Google Drive */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Google Drive Project Folder
          </h3>

          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-3">
              Enter the Google Drive folder ID where your project files are stored.
              You can find this in the folder's URL after /folders/
            </p>
            {googleAccessToken ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={localKeys.driveFolderId}
                  onChange={(e) => setLocalKeys({ ...localKeys, driveFolderId: e.target.value })}
                  placeholder="1a2b3c4d5e6f7g8h9i0j..."
                  className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 text-sm font-mono"
                />
                <button
                  onClick={handleSaveDriveFolder}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  Save
                </button>
              </div>
            ) : (
              <p className="text-yellow-400 text-sm">
                Connect Google Drive first (in Auth tab)
              </p>
            )}
          </div>
        </section>

        {/* GitHub Repository */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Github className="w-5 h-5" />
            GitHub Repository
          </h3>

          <div className="bg-gray-800 rounded-lg p-4">
            {githubToken ? (
              <>
                <p className="text-sm text-gray-400 mb-3">
                  Select the repository for git operations
                </p>
                <select
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
                >
                  <option value="">Select a repository...</option>
                  {repos.map((repo) => (
                    <option key={repo.id} value={repo.full_name}>
                      {repo.full_name} {repo.private && '(private)'}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <p className="text-yellow-400 text-sm">
                Connect GitHub first (in Auth tab)
              </p>
            )}
          </div>
        </section>

        {/* Info */}
        <section className="bg-gray-800/50 rounded-lg p-4 text-sm text-gray-400">
          <h4 className="font-medium text-gray-300 mb-2">How it works:</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>Files are stored in your Google Drive and sync to your local machine</li>
            <li>Git operations go through GitHub's API - no local git needed</li>
            <li>Your API keys are stored in browser localStorage (never sent to our servers)</li>
            <li>This app runs entirely in your browser - no backend required</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
