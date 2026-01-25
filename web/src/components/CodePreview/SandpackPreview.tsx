import { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview as SandpackPreviewPanel,
  SandpackConsole,
  useSandpack,
} from '@codesandbox/sandpack-react';
import type { ConsoleEntry } from '../../lib/types';

interface SandpackPreviewProps {
  mode: 'sandpack-react' | 'sandpack-vanilla';
  files: Record<string, string>;
  entryFile: string;
  onConsoleMessage: (entry: ConsoleEntry) => void;
}

// Component to capture console messages
function ConsoleCapture({ onConsoleMessage }: { onConsoleMessage: (entry: ConsoleEntry) => void }) {
  const { listen } = useSandpack();

  useEffect(() => {
    const unsubscribe = listen((message) => {
      if (message.type === 'console') {
        const logs = message.log || [];
        logs.forEach((log: { method: string; data: unknown[] }) => {
          const type = log.method === 'error' ? 'error'
            : log.method === 'warn' ? 'warn'
            : log.method === 'info' ? 'info'
            : 'log';

          const content = log.data
            .map((d) => (typeof d === 'object' ? JSON.stringify(d, null, 2) : String(d)))
            .join(' ');

          onConsoleMessage({
            type,
            content,
            timestamp: Date.now(),
          });
        });
      }
    });

    return () => unsubscribe();
  }, [listen, onConsoleMessage]);

  return null;
}

export function SandpackPreview({ mode, files, entryFile, onConsoleMessage }: SandpackPreviewProps) {
  // Build Sandpack files structure
  const sandpackFiles: Record<string, string> = {};

  if (mode === 'sandpack-react') {
    // For React, we need to set up the entry point
    const mainFile = entryFile || Object.keys(files)[0];
    const mainContent = files[mainFile] || '';

    // Determine file extension
    const ext = mainFile.split('.').pop()?.toLowerCase();
    const isTypeScript = ext === 'tsx' || ext === 'ts';

    sandpackFiles['/App.' + (isTypeScript ? 'tsx' : 'jsx')] = mainContent;

    // Add other files
    Object.entries(files).forEach(([name, content]) => {
      if (name !== mainFile) {
        sandpackFiles['/' + name] = content;
      }
    });

    // Add CSS if any file has .css
    const cssFile = Object.entries(files).find(([name]) => name.endsWith('.css'));
    if (cssFile) {
      sandpackFiles['/styles.css'] = cssFile[1];
    }
  } else {
    // Vanilla mode - HTML/JS/CSS
    const htmlFile = Object.entries(files).find(([name]) => name.endsWith('.html'));
    const jsFile = Object.entries(files).find(([name]) => name.endsWith('.js') && !name.endsWith('.min.js'));
    const cssFile = Object.entries(files).find(([name]) => name.endsWith('.css'));

    if (htmlFile) {
      sandpackFiles['/index.html'] = htmlFile[1];
    } else {
      // Create default HTML that includes JS and CSS
      sandpackFiles['/index.html'] = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app"></div>
  <script src="index.js"></script>
</body>
</html>`;
    }

    if (jsFile) {
      sandpackFiles['/index.js'] = jsFile[1];
    } else if (files[entryFile]) {
      sandpackFiles['/index.js'] = files[entryFile];
    }

    if (cssFile) {
      sandpackFiles['/styles.css'] = cssFile[1];
    } else {
      sandpackFiles['/styles.css'] = '';
    }
  }

  const template = mode === 'sandpack-react' ? 'react' : 'vanilla';

  if (Object.keys(sandpackFiles).length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'text.secondary',
        }}
      >
        <Typography>No files to preview</Typography>
      </Box>
    );
  }

  return (
    <SandpackProvider
      template={template}
      files={sandpackFiles}
      theme="dark"
      options={{
        recompileMode: 'delayed',
        recompileDelay: 300,
      }}
    >
      <ConsoleCapture onConsoleMessage={onConsoleMessage} />
      <SandpackLayout style={{ height: '100%', border: 'none' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <SandpackPreviewPanel
              showOpenInCodeSandbox={false}
              showRefreshButton={true}
              style={{ height: '100%' }}
            />
          </Box>
          <Box sx={{ height: 150, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <SandpackConsole style={{ height: '100%' }} />
          </Box>
        </Box>
      </SandpackLayout>
    </SandpackProvider>
  );
}
