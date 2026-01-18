import { Command } from 'commander';

export interface CliOptions {
  config?: string;
  noStartup: boolean;
  noAutoCommit: boolean;
  verbose: boolean;
}

export function parseCliArgs(argv: string[]): CliOptions {
  const program = new Command();

  program
    .name('studiora-dev')
    .description('Terminal wrapper for Claude Code with git hygiene and context management')
    .version('0.1.0')
    .option('-c, --config <path>', 'path to configuration file')
    .option('--no-startup', 'skip startup checklist')
    .option('--no-auto-commit', 'disable automatic commits')
    .option('-v, --verbose', 'enable verbose output', false);

  program.parse(argv);

  const opts = program.opts();

  return {
    config: opts.config,
    noStartup: opts.startup === false,
    noAutoCommit: opts.autoCommit === false,
    verbose: opts.verbose,
  };
}
