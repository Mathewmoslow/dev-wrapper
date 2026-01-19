import { useState, useEffect, useCallback, useRef } from 'react';
import { ClaudeProcess, ClaudeProcessOptions } from '../modules/claude/process.js';

export interface UseClaudeOptions extends ClaudeProcessOptions {
  autoStart?: boolean;
  onData?: (data: string) => void;
  onExit?: (code: number) => void;
}

export interface UseClaudeReturn {
  isRunning: boolean;
  output: string;
  start: () => void;
  stop: () => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  clear: () => void;
}

export function useClaude(options: UseClaudeOptions = {}): UseClaudeReturn {
  const { autoStart = false, onData, onExit, ...processOptions } = options;

  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState('');
  const processRef = useRef<ClaudeProcess | null>(null);

  // Initialize process
  useEffect(() => {
    processRef.current = new ClaudeProcess();

    const proc = processRef.current;

    proc.on('data', (data: string) => {
      setOutput((prev) => prev + data);
      onData?.(data);
    });

    proc.on('exit', (code: number) => {
      setIsRunning(false);
      onExit?.(code);
    });

    proc.on('error', (error: Error) => {
      console.error('Claude process error:', error);
      setIsRunning(false);
    });

    if (autoStart) {
      proc.spawn(processOptions);
      setIsRunning(true);
    }

    return () => {
      proc.kill();
      processRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    if (processRef.current && !processRef.current.isRunning) {
      setOutput('');
      processRef.current.spawn(processOptions);
      setIsRunning(true);
    }
  }, [processOptions]);

  const stop = useCallback(() => {
    if (processRef.current) {
      processRef.current.kill();
      setIsRunning(false);
    }
  }, []);

  const write = useCallback((data: string) => {
    if (processRef.current) {
      processRef.current.write(data);
    }
  }, []);

  const resize = useCallback((cols: number, rows: number) => {
    if (processRef.current) {
      processRef.current.resize(cols, rows);
    }
  }, []);

  const clear = useCallback(() => {
    setOutput('');
  }, []);

  return {
    isRunning,
    output,
    start,
    stop,
    write,
    resize,
    clear,
  };
}
