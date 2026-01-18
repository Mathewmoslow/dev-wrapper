#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './app.js';
import { parseCliArgs } from './cli.js';
import { loadConfig } from './core/config.js';

async function main() {
  const options = parseCliArgs(process.argv);
  const config = await loadConfig();

  render(
    <App
      config={config}
      skipStartup={options.noStartup}
    />
  );
}

main().catch((error) => {
  console.error('Error starting studiora-dev:', error);
  process.exit(1);
});
