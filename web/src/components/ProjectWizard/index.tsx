import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  LinearProgress,
  Chip,
  IconButton,
} from '@mui/material';
import {
  AutoAwesome,
  Code,
  Palette,
  Check,
  Close,
  ArrowBack,
  FolderOpen,
} from '@mui/icons-material';
import { useAppStore } from '../../stores/app-store';
import { GoogleDriveClient } from '../../lib/google-drive';
import type { ProjectConfig as StoreProjectConfig } from '../../lib/studiora-config';

// Glass styling (matching Workspace)
const glassPanel = {
  background: 'rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: '24px',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
};

const glassButton = {
  background: 'rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '12px',
  color: 'white',
  px: 3,
  py: 1.5,
  fontSize: '0.9rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  '&:hover': {
    background: 'rgba(255, 255, 255, 0.2)',
    transform: 'translateY(-1px)',
  },
  '&:disabled': {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
};

const primaryGlassButton = {
  ...glassButton,
  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.8), rgba(168, 85, 247, 0.8))',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  '&:hover': {
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(168, 85, 247, 0.9))',
    boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)',
  },
};

const glassInput = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(255,255,255,0.05)',
    borderRadius: '14px',
    fontSize: '16px',
    color: 'white',
    '& fieldset': {
      borderColor: 'rgba(255,255,255,0.15)',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(255,255,255,0.25)',
    },
    '&.Mui-focused fieldset': {
      borderColor: 'rgba(139, 92, 246, 0.6)',
    },
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(255,255,255,0.5)',
  },
  '& .MuiInputBase-input::placeholder': {
    color: 'rgba(255,255,255,0.4)',
  },
};

const glassSelect = {
  bgcolor: 'rgba(255,255,255,0.05)',
  borderRadius: '14px',
  color: 'white',
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'rgba(255,255,255,0.15)',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: 'rgba(255,255,255,0.25)',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: 'rgba(139, 92, 246, 0.6)',
  },
  '& .MuiSvgIcon-root': {
    color: 'rgba(255,255,255,0.5)',
  },
};

// Framework options
const FRAMEWORKS = [
  { value: 'react-vite', label: 'React + Vite', description: 'Fast web apps' },
  { value: 'react-native-expo', label: 'React Native + Expo', description: 'iOS & Android apps' },
  { value: 'nextjs', label: 'Next.js', description: 'Full-stack React' },
  { value: 'vue-vite', label: 'Vue + Vite', description: 'Progressive web apps' },
  { value: 'vanilla', label: 'Vanilla JS', description: 'Plain HTML/CSS/JS' },
  { value: 'node', label: 'Node.js', description: 'Backend/CLI apps' },
];

const STYLING = [
  { value: 'tailwind', label: 'Tailwind CSS', description: 'Utility-first CSS' },
  { value: 'nativewind', label: 'NativeWind', description: 'Tailwind for React Native' },
  { value: 'css-modules', label: 'CSS Modules', description: 'Scoped CSS' },
  { value: 'styled-components', label: 'Styled Components', description: 'CSS-in-JS' },
  { value: 'none', label: 'Plain CSS', description: 'No framework' },
];

// Compatibility rules
const STYLING_COMPATIBILITY: Record<string, string[]> = {
  'react-vite': ['tailwind', 'css-modules', 'styled-components', 'none'],
  'react-native-expo': ['nativewind', 'styled-components', 'none'],
  'nextjs': ['tailwind', 'css-modules', 'styled-components', 'none'],
  'vue-vite': ['tailwind', 'css-modules', 'none'],
  'vanilla': ['tailwind', 'none'],
  'node': ['none'],
};

interface ProjectConfig {
  name: string;
  description: string;
  framework: string;
  styling: string;
  packages: string[];
}

interface Props {
  onComplete: () => void;
  onCancel: () => void;
}

type WizardStep = 'describe' | 'configure' | 'creating' | 'done';

export function ProjectWizard({ onComplete, onCancel }: Props) {
  const {
    googleAccessToken,
    sendMessage,
    setDriveFolder,
    setProjectConfig,
    clearMessages,
  } = useAppStore();

  const [step, setStep] = useState<WizardStep>('describe');
  const [description, setDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [config, setConfig] = useState<ProjectConfig>({
    name: '',
    description: '',
    framework: 'react-vite',
    styling: 'tailwind',
    packages: [],
  });
  const [aiDisagreement, setAiDisagreement] = useState<string | null>(null);
  const [hasDisagreedOnce, setHasDisagreedOnce] = useState(false);
  const [creationProgress, setCreationProgress] = useState(0);
  const [creationStatus, setCreationStatus] = useState('');
  const [createdFiles, setCreatedFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Get compatible styling options for selected framework
  const compatibleStyling = STYLING.filter(s =>
    STYLING_COMPATIBILITY[config.framework]?.includes(s.value)
  );

  // Update styling if current selection is incompatible
  useEffect(() => {
    if (!STYLING_COMPATIBILITY[config.framework]?.includes(config.styling)) {
      setConfig(prev => ({
        ...prev,
        styling: STYLING_COMPATIBILITY[config.framework]?.[0] || 'none',
      }));
    }
  }, [config.framework, config.styling]);

  const analyzeDescription = async () => {
    if (!description.trim()) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      // Clear previous messages and ask AI to analyze
      clearMessages();

      const prompt = `You are helping set up a new coding project. The user described what they want to build:

"${description}"

Based on this description, suggest:
1. A short project name (2-4 words, no special characters)
2. The best framework from: react-vite, react-native-expo, nextjs, vue-vite, vanilla, node
3. The best styling approach from: tailwind, nativewind (only for react-native), css-modules, styled-components, none
4. 3-5 key npm packages that would be useful (not including the framework itself)

Respond in this exact JSON format only, no other text:
{"name": "Project Name", "framework": "react-vite", "styling": "tailwind", "packages": ["package1", "package2"]}`;

      await sendMessage(prompt);

      // Get the response from the store
      const messages = useAppStore.getState().messages;
      const lastMessage = messages[messages.length - 1];

      if (lastMessage?.role === 'assistant') {
        try {
          // Extract JSON from response
          const jsonMatch = lastMessage.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const suggestion = JSON.parse(jsonMatch[0]);
            setConfig({
              name: suggestion.name || 'My Project',
              description: description,
              framework: suggestion.framework || 'react-vite',
              styling: suggestion.styling || 'tailwind',
              packages: suggestion.packages || [],
            });
          }
        } catch (e) {
          console.error('Failed to parse AI suggestion:', e);
          // Use defaults
          setConfig(prev => ({
            ...prev,
            name: 'My Project',
            description: description,
          }));
        }
      }

      setStep('configure');
    } catch (err) {
      console.error('Analysis failed:', err);
      setError('Failed to analyze. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const checkCompatibilityAndCreate = async () => {
    // Check if AI should disagree (only once)
    if (!hasDisagreedOnce) {
      const incompatibilities: string[] = [];

      // Check for known bad combinations
      if (config.framework === 'react-vite' && config.styling === 'nativewind') {
        incompatibilities.push('NativeWind is designed for React Native, not web React. Consider Tailwind CSS instead.');
      }
      if (config.framework === 'node' && config.styling !== 'none') {
        incompatibilities.push('Node.js backend projects typically don\'t need CSS styling.');
      }
      if (config.framework === 'vanilla' && config.styling === 'styled-components') {
        incompatibilities.push('Styled Components requires React. Consider Tailwind or plain CSS.');
      }

      if (incompatibilities.length > 0) {
        setAiDisagreement(incompatibilities[0]);
        setHasDisagreedOnce(true);
        return;
      }
    }

    // Proceed with creation
    await createProject();
  };

  const createProject = async () => {
    setStep('creating');
    setCreationProgress(0);
    setError(null);

    if (!googleAccessToken) {
      setError('Please connect Google Drive first');
      return;
    }

    const driveClient = new GoogleDriveClient(googleAccessToken);

    try {
      // Step 1: Create folder in Google Drive
      setCreationStatus('Creating project folder...');
      setCreationProgress(10);

      // First, find or create the Studiora root folder
      let studiorFolderId: string;
      const existingFolders = await driveClient.listFiles('root');
      const studioraFolder = existingFolders.find(f => f.name === 'Studiora' && f.mimeType === 'application/vnd.google-apps.folder');

      if (studioraFolder) {
        studiorFolderId = studioraFolder.id;
      } else {
        const newFolder = await driveClient.createFolder('Studiora', 'root');
        studiorFolderId = newFolder.id;
      }

      // Create project folder inside Studiora
      const projectFolder = await driveClient.createFolder(config.name, studiorFolderId);
      const projectFolderId = projectFolder.id;

      setCreationProgress(20);

      // Step 2: Generate project files using AI
      setCreationStatus('Generating project structure...');

      const filePrompt = `Generate the starter files for a ${config.framework} project with ${config.styling} styling.
Project name: ${config.name}
Description: ${config.description}
Additional packages: ${config.packages.join(', ')}

Generate the essential starter files. For each file, use this exact format:
\`\`\`filename:path/to/file.ext
file contents here
\`\`\`

Include at minimum:
- package.json with all dependencies
- Main entry file (index.js, App.tsx, etc.)
- Basic component or page
- Any config files needed (vite.config.ts, tsconfig.json, etc.)
- A simple README.md

Keep files minimal but functional - this is a starter template.`;

      clearMessages();
      await sendMessage(filePrompt);

      setCreationProgress(50);
      setCreationStatus('Writing files to Google Drive...');

      // Parse the response for files
      const messages = useAppStore.getState().messages;
      const lastMessage = messages[messages.length - 1];

      if (lastMessage?.role === 'assistant') {
        const fileRegex = /```(?:\w+:)?([^\n`]+)\n([\s\S]*?)```/g;
        let match;
        const files: { path: string; content: string }[] = [];

        while ((match = fileRegex.exec(lastMessage.content)) !== null) {
          const [, filename, content] = match;
          if (filename && content) {
            const cleanPath = filename.trim().replace(/^\/+/, '');
            if (cleanPath.includes('.')) {
              files.push({ path: cleanPath, content: content.trim() });
            }
          }
        }

        // Write files to Drive
        const totalFiles = files.length;
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setCreationStatus(`Writing ${file.path}...`);

          try {
            await driveClient.createFile(file.path, file.content, projectFolderId);
            setCreatedFiles(prev => [...prev, file.path]);
          } catch (err) {
            console.error(`Failed to write ${file.path}:`, err);
          }

          setCreationProgress(50 + Math.round((i + 1) / totalFiles * 40));
        }
      }

      // Step 3: Create .studiora/project.json config file
      setCreationStatus('Saving project config...');
      setCreationProgress(95);

      // Map framework to store format
      const frameworkMap: Record<string, StoreProjectConfig['stack']['framework']> = {
        'react-vite': 'react',
        'react-native-expo': 'react',
        'nextjs': 'next',
        'vue-vite': 'vue',
        'vanilla': 'none',
        'node': 'express',
      };

      const stylingMap: Record<string, StoreProjectConfig['stack']['styling']> = {
        'tailwind': 'tailwind',
        'nativewind': 'tailwind',
        'css-modules': 'css',
        'styled-components': 'css',
        'none': 'none',
      };

      const storeProjectConfig: StoreProjectConfig = {
        name: config.name,
        description: config.description,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        stack: {
          framework: frameworkMap[config.framework] || 'none',
          language: 'typescript',
          styling: stylingMap[config.styling] || 'none',
        },
        security: {
          envVars: [],
          secretsPattern: ['.env*', '*.key', '*.pem'],
          httpsEnforced: true,
        },
        aiContext: `Project created with ${config.framework} and ${config.styling}. Additional packages: ${config.packages.join(', ')}`,
      };

      // Create .studiora folder
      const studioraConfigFolder = await driveClient.createFolder('.studiora', projectFolderId);
      await driveClient.createFile('project.json', JSON.stringify(storeProjectConfig, null, 2), studioraConfigFolder.id);

      // Update store
      setDriveFolder(projectFolderId);
      setProjectConfig(storeProjectConfig);

      setCreationProgress(100);
      setCreationStatus('Done!');
      setStep('done');

    } catch (err) {
      console.error('Project creation failed:', err);
      setError(`Failed to create project: ${err}`);
      setStep('configure');
    }
  };

  // Render based on step
  return (
    <Box sx={{
      minHeight: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      p: 3,
      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 25%, #4c1d95 50%, #581c87 75%, #701a75 100%)',
    }}>
      <Box sx={{ ...glassPanel, maxWidth: 600, width: '100%', p: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          {step !== 'describe' && step !== 'done' && (
            <IconButton
              onClick={() => step === 'configure' ? setStep('describe') : null}
              sx={{ color: 'rgba(255,255,255,0.6)' }}
              disabled={step === 'creating'}
            >
              <ArrowBack />
            </IconButton>
          )}
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ color: 'white', fontSize: '1.5rem', fontWeight: 600 }}>
              {step === 'describe' && 'New Project'}
              {step === 'configure' && 'Configure Project'}
              {step === 'creating' && 'Creating Project'}
              {step === 'done' && 'Project Ready!'}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
              {step === 'describe' && 'Describe what you want to build'}
              {step === 'configure' && 'Review and adjust the setup'}
              {step === 'creating' && 'Setting up your project...'}
              {step === 'done' && `${createdFiles.length} files created`}
            </Typography>
          </Box>
          <IconButton onClick={onCancel} sx={{ color: 'rgba(255,255,255,0.6)' }}>
            <Close />
          </IconButton>
        </Box>

        {/* Step 1: Describe */}
        {step === 'describe' && (
          <Box>
            <TextField
              fullWidth
              multiline
              rows={4}
              placeholder="e.g., A workout tracking app for iOS and Android with progress charts and social features..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              sx={{ ...glassInput, mb: 3 }}
            />

            {error && (
              <Typography sx={{ color: '#f87171', fontSize: '0.85rem', mb: 2 }}>
                {error}
              </Typography>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Box
                component="button"
                onClick={onCancel}
                sx={glassButton}
              >
                Cancel
              </Box>
              <Box
                component="button"
                onClick={analyzeDescription}
                disabled={!description.trim() || isAnalyzing}
                sx={primaryGlassButton}
              >
                {isAnalyzing ? (
                  <>
                    <CircularProgress size={18} sx={{ color: 'white', mr: 1 }} />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <AutoAwesome sx={{ fontSize: 18, mr: 1 }} />
                    Continue
                  </>
                )}
              </Box>
            </Box>
          </Box>
        )}

        {/* Step 2: Configure */}
        {step === 'configure' && (
          <Box>
            {/* Project name */}
            <TextField
              fullWidth
              label="Project Name"
              value={config.name}
              onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
              sx={{ ...glassInput, mb: 2 }}
            />

            {/* Framework */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.5)' }}>Framework</InputLabel>
              <Select
                value={config.framework}
                onChange={(e) => setConfig(prev => ({ ...prev, framework: e.target.value }))}
                label="Framework"
                sx={glassSelect}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      bgcolor: '#1e1b4b',
                      border: '1px solid rgba(255,255,255,0.15)',
                    },
                  },
                }}
              >
                {FRAMEWORKS.map((fw) => (
                  <MenuItem key={fw.value} value={fw.value} sx={{ color: 'white' }}>
                    <Box>
                      <Typography>{fw.label}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                        {fw.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Styling */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.5)' }}>Styling</InputLabel>
              <Select
                value={config.styling}
                onChange={(e) => setConfig(prev => ({ ...prev, styling: e.target.value }))}
                label="Styling"
                sx={glassSelect}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      bgcolor: '#1e1b4b',
                      border: '1px solid rgba(255,255,255,0.15)',
                    },
                  },
                }}
              >
                {compatibleStyling.map((st) => (
                  <MenuItem key={st.value} value={st.value} sx={{ color: 'white' }}>
                    <Box>
                      <Typography>{st.label}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                        {st.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Packages */}
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', mb: 1 }}>
                Suggested Packages
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {config.packages.map((pkg) => (
                  <Chip
                    key={pkg}
                    label={pkg}
                    onDelete={() => setConfig(prev => ({
                      ...prev,
                      packages: prev.packages.filter(p => p !== pkg),
                    }))}
                    sx={{
                      bgcolor: 'rgba(139, 92, 246, 0.2)',
                      color: 'white',
                      '& .MuiChip-deleteIcon': {
                        color: 'rgba(255,255,255,0.5)',
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* AI Disagreement */}
            {aiDisagreement && (
              <Box sx={{
                p: 2,
                mb: 3,
                borderRadius: '12px',
                bgcolor: 'rgba(251, 191, 36, 0.15)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
              }}>
                <Typography sx={{ color: '#fbbf24', fontSize: '0.9rem', mb: 1.5 }}>
                  <AutoAwesome sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                  AI Suggestion
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', mb: 2 }}>
                  {aiDisagreement}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Box
                    component="button"
                    onClick={() => {
                      // Apply AI suggestion
                      if (aiDisagreement.includes('Tailwind CSS')) {
                        setConfig(prev => ({ ...prev, styling: 'tailwind' }));
                      } else if (aiDisagreement.includes('don\'t need CSS')) {
                        setConfig(prev => ({ ...prev, styling: 'none' }));
                      }
                      setAiDisagreement(null);
                    }}
                    sx={{ ...glassButton, py: 1, px: 2, fontSize: '0.8rem' }}
                  >
                    Accept suggestion
                  </Box>
                  <Box
                    component="button"
                    onClick={() => {
                      setAiDisagreement(null);
                      createProject();
                    }}
                    sx={{ ...glassButton, py: 1, px: 2, fontSize: '0.8rem' }}
                  >
                    Keep my choice
                  </Box>
                </Box>
              </Box>
            )}

            {error && (
              <Typography sx={{ color: '#f87171', fontSize: '0.85rem', mb: 2 }}>
                {error}
              </Typography>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Box
                component="button"
                onClick={() => setStep('describe')}
                sx={glassButton}
              >
                Back
              </Box>
              <Box
                component="button"
                onClick={checkCompatibilityAndCreate}
                disabled={!config.name.trim()}
                sx={primaryGlassButton}
              >
                Create Project
              </Box>
            </Box>
          </Box>
        )}

        {/* Step 3: Creating */}
        {step === 'creating' && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress
              size={64}
              sx={{
                color: 'rgba(139, 92, 246, 0.8)',
                mb: 3,
              }}
            />
            <Typography sx={{ color: 'white', fontSize: '1.1rem', mb: 1 }}>
              {creationStatus}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={creationProgress}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: 'rgba(255,255,255,0.1)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                },
              }}
            />

            {createdFiles.length > 0 && (
              <Box sx={{ mt: 3, textAlign: 'left' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', mb: 1 }}>
                  Files created:
                </Typography>
                {createdFiles.slice(-5).map((file) => (
                  <Box key={file} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Check sx={{ fontSize: 14, color: '#10b981' }} />
                    <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>
                      {file}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* Step 4: Done */}
        {step === 'done' && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Box sx={{
              width: 80,
              height: 80,
              borderRadius: '24px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(52, 211, 153, 0.3))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3,
            }}>
              <Check sx={{ fontSize: 40, color: '#10b981' }} />
            </Box>

            <Typography sx={{ color: 'white', fontSize: '1.3rem', fontWeight: 600, mb: 1 }}>
              {config.name}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', mb: 3 }}>
              {createdFiles.length} files created in Google Drive
            </Typography>

            <Box sx={{
              p: 2,
              borderRadius: '12px',
              bgcolor: 'rgba(255,255,255,0.05)',
              mb: 3,
              textAlign: 'left',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Code sx={{ fontSize: 18, color: '#a855f7' }} />
                <Typography sx={{ color: 'white', fontSize: '0.9rem' }}>
                  {FRAMEWORKS.find(f => f.value === config.framework)?.label}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Palette sx={{ fontSize: 18, color: '#a855f7' }} />
                <Typography sx={{ color: 'white', fontSize: '0.9rem' }}>
                  {STYLING.find(s => s.value === config.styling)?.label}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FolderOpen sx={{ fontSize: 18, color: '#a855f7' }} />
                <Typography sx={{ color: 'white', fontSize: '0.9rem' }}>
                  /Studiora/{config.name}
                </Typography>
              </Box>
            </Box>

            <Box
              component="button"
              onClick={onComplete}
              sx={{ ...primaryGlassButton, width: '100%' }}
            >
              <FolderOpen sx={{ fontSize: 20, mr: 1 }} />
              Open in Workspace
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
