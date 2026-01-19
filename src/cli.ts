import { Command } from 'commander';

export interface CliOptions {
  config?: string;
  noStartup: boolean;
  noAutoCommit: boolean;
  verbose: boolean;
  directory: string;
  newProject: boolean;
}

export function parseCliArgs(argv: string[]): CliOptions {
  const program = new Command();

  program
    .name('studiora-dev')
    .description('AI-powered development environment with multi-provider support')
    .version('0.1.0')
    .argument('[directory]', 'project directory to work in', process.cwd())
    .option('-c, --config <path>', 'path to configuration file')
    .option('--no-startup', 'skip startup checklist')
    .option('--no-auto-commit', 'disable automatic commits')
    .option('-v, --verbose', 'enable verbose output', false)
    .option('-n, --new', 'create a new project (runs setup wizard)', false);

  program.parse(argv);

  const opts = program.opts();
  const directory = program.args[0] || process.cwd();

  return {
    config: opts.config,
    noStartup: opts.startup === false,
    noAutoCommit: opts.autoCommit === false,
    verbose: opts.verbose,
    directory,
    newProject: opts.new || false,
  };
}
