// Project scaffolding templates for WebContainer
// These provide the initial file structure needed to run projects

export interface ProjectTemplate {
  name: string;
  description: string;
  files: Record<string, string>;
}

export const REACT_VITE_TEMPLATE: ProjectTemplate = {
  name: 'React + Vite',
  description: 'Modern React app with Vite bundler and TypeScript',
  files: {
    'package.json': JSON.stringify({
      name: 'my-app',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc -b && vite build',
        preview: 'vite preview'
      },
      dependencies: {
        react: '^18.3.1',
        'react-dom': '^18.3.1'
      },
      devDependencies: {
        '@types/react': '^18.3.0',
        '@types/react-dom': '^18.3.0',
        '@vitejs/plugin-react': '^4.3.0',
        typescript: '^5.5.0',
        vite: '^5.4.0'
      }
    }, null, 2),

    'vite.config.ts': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`,

    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true
      },
      include: ['src']
    }, null, 2),

    'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,

    'src/main.tsx': `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`,

    'src/App.tsx': `import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="app">
      <h1>Welcome to Your App</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          Count is {count}
        </button>
        <p>Edit <code>src/App.tsx</code> and save to see changes</p>
      </div>
    </div>
  )
}

export default App
`,

    'src/App.css': `.app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.card {
  padding: 2em;
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  color: #fff;
  cursor: pointer;
  transition: border-color 0.25s;
}

button:hover {
  border-color: #646cff;
}

button:focus,
button:focus-visible {
  outline: 4px auto -webkit-focus-ring-color;
}
`,

    'src/index.css': `:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

h1 {
  font-size: 3.2em;
  line-height: 1.1;
}
`,
  }
};

export const NODE_EXPRESS_TEMPLATE: ProjectTemplate = {
  name: 'Node.js + Express',
  description: 'Simple Express.js server',
  files: {
    'package.json': JSON.stringify({
      name: 'my-server',
      version: '1.0.0',
      type: 'module',
      scripts: {
        start: 'node index.js',
        dev: 'node --watch index.js'
      },
      dependencies: {
        express: '^4.18.2'
      }
    }, null, 2),

    'index.js': `import express from 'express';

const app = express();
const port = 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Express!' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`);
});
`,
  }
};

export const VANILLA_HTML_TEMPLATE: ProjectTemplate = {
  name: 'Vanilla HTML/CSS/JS',
  description: 'Simple static site with HTML, CSS, and JavaScript',
  files: {
    'package.json': JSON.stringify({
      name: 'my-site',
      version: '1.0.0',
      scripts: {
        dev: 'npx serve .'
      },
      devDependencies: {
        serve: '^14.2.0'
      }
    }, null, 2),

    'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Site</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container">
    <h1>Welcome!</h1>
    <p>Edit the files and refresh to see changes.</p>
    <button id="btn">Click me</button>
    <p id="output"></p>
  </div>
  <script src="script.js"></script>
</body>
</html>
`,

    'styles.css': `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, sans-serif;
  background: #1a1a2e;
  color: #eee;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.container {
  text-align: center;
  padding: 2rem;
}

h1 {
  margin-bottom: 1rem;
  color: #00d9ff;
}

button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  border: none;
  border-radius: 6px;
  background: #00d9ff;
  color: #1a1a2e;
  cursor: pointer;
  margin: 1rem 0;
}

button:hover {
  background: #00b8d9;
}

#output {
  margin-top: 1rem;
  font-size: 1.2rem;
}
`,

    'script.js': `let count = 0;

document.getElementById('btn').addEventListener('click', () => {
  count++;
  document.getElementById('output').textContent = \`Clicked \${count} times\`;
});
`,
  }
};

// Get template by type
export function getTemplate(type: 'react' | 'node' | 'vanilla'): ProjectTemplate {
  switch (type) {
    case 'react':
      return REACT_VITE_TEMPLATE;
    case 'node':
      return NODE_EXPRESS_TEMPLATE;
    case 'vanilla':
      return VANILLA_HTML_TEMPLATE;
    default:
      return REACT_VITE_TEMPLATE;
  }
}

// Convert template files to WebContainer mount format
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function templateToMountStructure(template: ProjectTemplate): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const structure: Record<string, any> = {};

  for (const [path, contents] of Object.entries(template.files)) {
    const parts = path.split('/');
    let current: Record<string, unknown> = structure;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        // It's a file
        current[part] = { file: { contents } };
      } else {
        // It's a directory
        if (!current[part]) {
          current[part] = { directory: {} };
        }
        current = (current[part] as { directory: Record<string, unknown> }).directory;
      }
    }
  }

  return structure;
}
