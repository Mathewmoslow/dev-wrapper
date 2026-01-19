import React, { useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { useClaude } from '../hooks/useClaude.js';
import { colors } from '../theme.js';

export interface TerminalProps {
  onExit?: (code: number) => void;
  onContextUpdate?: (tokens: number) => void;
}

export function Terminal({ onExit, onContextUpdate }: TerminalProps) {
  const { stdout } = useStdout();
  const cols = stdout?.columns || 80;
  const rows = stdout?.rows || 24;

  const { isRunning, output, start, write, resize } = useClaude({
    autoStart: true,
    onExit: (code) => {
      onExit?.(code);
    },
    onData: (data) => {
      // TODO: Parse output to detect token usage patterns
      // Claude outputs context info that we can parse
    },
  });

  // Handle terminal resize
  useEffect(() => {
    const handleResize = () => {
      if (stdout) {
        resize(stdout.columns, stdout.rows);
      }
    };

    stdout?.on('resize', handleResize);
    return () => {
      stdout?.off('resize', handleResize);
    };
  }, [stdout, resize]);

  // Handle keyboard input
  useInput((input, key) => {
    // Pass through to Claude
    if (key.return) {
      write('\r');
    } else if (key.backspace || key.delete) {
      write('\x7f');
    } else if (key.escape) {
      write('\x1b');
    } else if (key.tab) {
      write('\t');
    } else if (key.upArrow) {
      write('\x1b[A');
    } else if (key.downArrow) {
      write('\x1b[B');
    } else if (key.leftArrow) {
      write('\x1b[D');
    } else if (key.rightArrow) {
      write('\x1b[C');
    } else if (key.ctrl && input === 'c') {
      write('\x03');
    } else if (key.ctrl && input === 'd') {
      write('\x04');
    } else if (input) {
      write(input);
    }
  }, { isActive: isRunning });

  if (!isRunning && output === '') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.muted}>Starting Claude...</Text>
      </Box>
    );
  }

  // Get the last N lines of output to fit in terminal
  const outputLines = output.split('\n');
  const visibleLines = outputLines.slice(-(rows - 4)); // Leave room for status bar

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Text>{visibleLines.join('\n')}</Text>
    </Box>
  );
}
