import { cosmiconfig } from 'cosmiconfig';
import type { StudioraConfig } from '../types/index.js';

const defaultConfig: StudioraConfig = {
  git: {
    autoCommitInterval: 15,
    autoCommitEnabled: true,
    commitPrefix: 'checkpoint',
    pushAfterCommit: false,
  },
  context: {
    warningThreshold: 70,
    handoffThreshold: 85,
    stopThreshold: 90,
    estimateMethod: 'token-count',
  },
  session: {
    handoffDir: '.claude/handoffs',
    maxHandoffAge: 7,
    autoLoadPreviousSession: true,
  },
  startup: {
    showGitLog: true,
    gitLogCount: 20,
    loadCriticalFixes: true,
    runGitStatus: true,
  },
};

export async function loadConfig(): Promise<StudioraConfig> {
  const explorer = cosmiconfig('studiora-dev', {
    searchPlaces: [
      'studiora-dev.config.json',
      'studiora-dev.config.js',
      '.studiora-devrc',
      '.studiora-devrc.json',
    ],
  });

  try {
    const result = await explorer.search();

    if (result && result.config) {
      return mergeConfig(defaultConfig, result.config);
    }
  } catch {
    // Config file not found or invalid, use defaults
  }

  return defaultConfig;
}

function mergeConfig(
  defaults: StudioraConfig,
  overrides: Partial<StudioraConfig>
): StudioraConfig {
  return {
    git: { ...defaults.git, ...overrides.git },
    context: { ...defaults.context, ...overrides.context },
    session: { ...defaults.session, ...overrides.session },
    startup: { ...defaults.startup, ...overrides.startup },
  };
}

export function getDefaultConfig(): StudioraConfig {
  return { ...defaultConfig };
}
