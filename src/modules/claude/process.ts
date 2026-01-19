import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface ClaudeProcessOptions {
  cwd?: string;
  env?: Record<string, string>;
  args?: string[];
}

export interface ClaudeProcessEvents {
  data: (data: string) => void;
  exit: (code: number, signal?: number) => void;
  error: (error: Error) => void;
}

export class ClaudeProcess extends EventEmitter {
  private childProcess: ChildProcess | null = null;
  private _isRunning = false;

  get isRunning(): boolean {
    return this._isRunning;
  }

  spawn(options: ClaudeProcessOptions = {}): void {
    if (this._isRunning) {
      throw new Error('Claude process is already running');
    }

    const {
      cwd = process.cwd(),
      env = process.env as Record<string, string>,
      args = [],
    } = options;

    try {
      // Build the claude command with args
      const claudeCmd = args.length > 0
        ? `claude ${args.join(' ')}`
        : 'claude';

      // Spawn through login shell to get proper PATH
      const shell = env.SHELL || '/bin/zsh';

      this.childProcess = spawn(shell, ['-l', '-i', '-c', claudeCmd], {
        cwd,
        env: {
          ...env,
          TERM: 'xterm-256color',
        },
        stdio: ['inherit', 'inherit', 'inherit'],
      });

      this._isRunning = true;

      // Handle exit
      this.childProcess.on('exit', (code, signal) => {
        this._isRunning = false;
        this.childProcess = null;
        this.emit('exit', code || 0, signal ? 1 : undefined);
      });

      this.childProcess.on('error', (error) => {
        this._isRunning = false;
        this.childProcess = null;
        this.emit('error', error);
      });

    } catch (error) {
      this._isRunning = false;
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  write(data: string): void {
    // With stdio: inherit, stdin goes directly to terminal
    // This is a no-op in this mode
  }

  resize(cols: number, rows: number): void {
    // Not supported in this mode
  }

  kill(signal: NodeJS.Signals = 'SIGTERM'): void {
    if (this.childProcess && this._isRunning) {
      this.childProcess.kill(signal);
      this._isRunning = false;
      this.childProcess = null;
    }
  }

  // Send Ctrl+C
  interrupt(): void {
    this.kill('SIGINT');
  }

  // Send Ctrl+D (EOF)
  sendEOF(): void {
    this.kill('SIGTERM');
  }
}

// Singleton for the main claude process
let mainProcess: ClaudeProcess | null = null;

export function getClaudeProcess(): ClaudeProcess {
  if (!mainProcess) {
    mainProcess = new ClaudeProcess();
  }
  return mainProcess;
}

export function destroyClaudeProcess(): void {
  if (mainProcess) {
    mainProcess.kill();
    mainProcess = null;
  }
}
