import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  AutoAwesome,
  Code,
  Security,
  Folder,
  Check,
  ArrowForward,
  ArrowBack,
} from '@mui/icons-material';
import { useAppStore } from '../stores/app-store';
import type { ProjectStack, SecurityConfig } from '../lib/studiora-config';

const steps = ['Describe Your Project', 'Review Stack', 'Security Setup', 'Create Project'];

interface AISuggestion {
  stack: ProjectStack;
  reasoning: string;
  features: string[];
  dependencies: string[];
}

export function ProjectInit() {
  const [activeStep, setActiveStep] = useState(0);
  const [projectDescription, setProjectDescription] = useState('');
  const [projectName, setProjectName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [customStack, setCustomStack] = useState<ProjectStack>({
    framework: 'react',
    language: 'typescript',
    styling: 'mui',
    database: 'none',
    deployment: 'vercel',
  });
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>({
    envVars: [],
    secretsPattern: ['*.env*', '.env.*', 'secrets.*'],
    httpsEnforced: true,
  });
  const [newEnvVar, setNewEnvVar] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    currentProvider,
    driveProjectFolderId,
    initNewProject,
    saveProjectConfig,
    setView,
  } = useAppStore();

  const analyzeProject = async () => {
    if (!projectDescription.trim()) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: currentProvider,
          messages: [{
            role: 'user',
            content: `Analyze this project idea and suggest the best tech stack. Respond in JSON format only.

Project: "${projectDescription}"

Respond with this exact JSON structure:
{
  "name": "suggested-project-name",
  "stack": {
    "framework": "react" | "next" | "vue" | "svelte" | "express" | "fastapi" | "none",
    "language": "typescript" | "javascript" | "python",
    "styling": "mui" | "tailwind" | "css" | "scss" | "none",
    "database": "postgres" | "mysql" | "mongodb" | "supabase" | "firebase" | "none",
    "deployment": "vercel" | "netlify" | "aws" | "gcp" | "docker" | "none"
  },
  "reasoning": "Brief explanation of why this stack",
  "features": ["feature1", "feature2"],
  "dependencies": ["package1", "package2"],
  "envVars": ["API_KEY_NAME"]
}`,
          }],
          systemPrompt: 'You are a senior software architect. Respond only with valid JSON, no markdown or explanation.',
        }),
      });

      if (!response.ok) throw new Error('Failed to analyze project');

      const data = await response.json();

      // Parse AI response
      try {
        // Try to extract JSON from response
        let jsonStr = data.content;
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }

        const suggestion = JSON.parse(jsonStr);

        setProjectName(suggestion.name || 'my-project');
        setCustomStack(suggestion.stack);
        setAiSuggestion({
          stack: suggestion.stack,
          reasoning: suggestion.reasoning,
          features: suggestion.features || [],
          dependencies: suggestion.dependencies || [],
        });

        if (suggestion.envVars) {
          setSecurityConfig(prev => ({
            ...prev,
            envVars: suggestion.envVars,
          }));
        }

        setActiveStep(1);
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
        setError('Failed to parse AI suggestions. Please try again.');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddEnvVar = () => {
    if (newEnvVar.trim() && !securityConfig.envVars.includes(newEnvVar.trim())) {
      setSecurityConfig(prev => ({
        ...prev,
        envVars: [...prev.envVars, newEnvVar.trim().toUpperCase()],
      }));
      setNewEnvVar('');
    }
  };

  const handleRemoveEnvVar = (envVar: string) => {
    setSecurityConfig(prev => ({
      ...prev,
      envVars: prev.envVars.filter(e => e !== envVar),
    }));
  };

  const createProject = async () => {
    if (!projectName.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      // Initialize project with config
      await initNewProject(projectName, projectDescription);

      // Save full config
      await saveProjectConfig({
        name: projectName,
        description: projectDescription,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        stack: customStack,
        security: securityConfig,
        aiContext: projectDescription,
      });

      // Navigate to chat
      setView('chat');
    } catch (err) {
      setError(String(err));
    } finally {
      setIsCreating(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoAwesome color="primary" />
              What do you want to build?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Describe your project in natural language. The AI will suggest the best tech stack.
            </Typography>

            <TextField
              fullWidth
              multiline
              rows={4}
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              placeholder="e.g., A dashboard to track my cryptocurrency portfolio with real-time prices, charts, and alerts..."
              sx={{ mb: 3 }}
            />

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
              <Typography variant="caption" color="text.secondary" sx={{ width: '100%', mb: 1 }}>
                Example ideas:
              </Typography>
              {[
                'A todo app with categories and due dates',
                'REST API for a blog with user auth',
                'Real-time chat application',
                'E-commerce product catalog',
              ].map((example) => (
                <Chip
                  key={example}
                  label={example}
                  size="small"
                  onClick={() => setProjectDescription(example)}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>

            <Button
              variant="contained"
              size="large"
              endIcon={isAnalyzing ? <CircularProgress size={20} color="inherit" /> : <ArrowForward />}
              onClick={analyzeProject}
              disabled={!projectDescription.trim() || isAnalyzing}
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze & Suggest Stack'}
            </Button>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Code color="primary" />
              Suggested Tech Stack
            </Typography>

            {aiSuggestion && (
              <Alert severity="info" sx={{ mb: 3 }}>
                {aiSuggestion.reasoning}
              </Alert>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, mb: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Framework</InputLabel>
                <Select
                  value={customStack.framework}
                  label="Framework"
                  onChange={(e) => setCustomStack(prev => ({ ...prev, framework: e.target.value as any }))}
                >
                  <MenuItem value="react">React</MenuItem>
                  <MenuItem value="next">Next.js</MenuItem>
                  <MenuItem value="vue">Vue</MenuItem>
                  <MenuItem value="svelte">Svelte</MenuItem>
                  <MenuItem value="express">Express (Node)</MenuItem>
                  <MenuItem value="fastapi">FastAPI (Python)</MenuItem>
                  <MenuItem value="none">None / Custom</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Language</InputLabel>
                <Select
                  value={customStack.language}
                  label="Language"
                  onChange={(e) => setCustomStack(prev => ({ ...prev, language: e.target.value as any }))}
                >
                  <MenuItem value="typescript">TypeScript</MenuItem>
                  <MenuItem value="javascript">JavaScript</MenuItem>
                  <MenuItem value="python">Python</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Styling</InputLabel>
                <Select
                  value={customStack.styling}
                  label="Styling"
                  onChange={(e) => setCustomStack(prev => ({ ...prev, styling: e.target.value as any }))}
                >
                  <MenuItem value="mui">Material UI</MenuItem>
                  <MenuItem value="tailwind">Tailwind CSS</MenuItem>
                  <MenuItem value="css">Plain CSS</MenuItem>
                  <MenuItem value="scss">SCSS</MenuItem>
                  <MenuItem value="none">None</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Database</InputLabel>
                <Select
                  value={customStack.database}
                  label="Database"
                  onChange={(e) => setCustomStack(prev => ({ ...prev, database: e.target.value as any }))}
                >
                  <MenuItem value="none">None / Later</MenuItem>
                  <MenuItem value="supabase">Supabase</MenuItem>
                  <MenuItem value="firebase">Firebase</MenuItem>
                  <MenuItem value="postgres">PostgreSQL</MenuItem>
                  <MenuItem value="mongodb">MongoDB</MenuItem>
                  <MenuItem value="mysql">MySQL</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Deployment</InputLabel>
                <Select
                  value={customStack.deployment}
                  label="Deployment"
                  onChange={(e) => setCustomStack(prev => ({ ...prev, deployment: e.target.value as any }))}
                >
                  <MenuItem value="vercel">Vercel</MenuItem>
                  <MenuItem value="netlify">Netlify</MenuItem>
                  <MenuItem value="docker">Docker</MenuItem>
                  <MenuItem value="aws">AWS</MenuItem>
                  <MenuItem value="gcp">Google Cloud</MenuItem>
                  <MenuItem value="none">None / Later</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {aiSuggestion?.features && aiSuggestion.features.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Suggested Features:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {aiSuggestion.features.map((feature) => (
                    <Chip key={feature} label={feature} size="small" variant="outlined" />
                  ))}
                </Box>
              </Box>
            )}

            <TextField
              fullWidth
              label="Project Name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              sx={{ mb: 3 }}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button onClick={() => setActiveStep(0)} startIcon={<ArrowBack />}>
                Back
              </Button>
              <Button
                variant="contained"
                endIcon={<ArrowForward />}
                onClick={() => setActiveStep(2)}
              >
                Configure Security
              </Button>
            </Box>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Security color="primary" />
              Security Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Define environment variables and security settings for your project.
            </Typography>

            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Environment Variables (Secrets)
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                These will be stored in .env and never committed to git.
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  size="small"
                  placeholder="API_KEY_NAME"
                  value={newEnvVar}
                  onChange={(e) => setNewEnvVar(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddEnvVar()}
                />
                <Button onClick={handleAddEnvVar} variant="outlined" size="small">
                  Add
                </Button>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {securityConfig.envVars.map((envVar) => (
                  <Chip
                    key={envVar}
                    label={envVar}
                    onDelete={() => handleRemoveEnvVar(envVar)}
                    size="small"
                  />
                ))}
              </Box>
            </Paper>

            <Paper sx={{ p: 2, mb: 3 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={securityConfig.httpsEnforced}
                    onChange={(e) => setSecurityConfig(prev => ({ ...prev, httpsEnforced: e.target.checked }))}
                  />
                }
                label="Enforce HTTPS in production"
              />
            </Paper>

            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="subtitle2">Security Best Practices Applied:</Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 32 }}><Check fontSize="small" color="success" /></ListItemIcon>
                  <ListItemText primary="API keys stored server-side only" />
                </ListItem>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 32 }}><Check fontSize="small" color="success" /></ListItemIcon>
                  <ListItemText primary=".gitignore configured for secrets" />
                </ListItem>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 32 }}><Check fontSize="small" color="success" /></ListItemIcon>
                  <ListItemText primary="Environment validation on startup" />
                </ListItem>
              </List>
            </Alert>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button onClick={() => setActiveStep(1)} startIcon={<ArrowBack />}>
                Back
              </Button>
              <Button
                variant="contained"
                endIcon={<ArrowForward />}
                onClick={() => setActiveStep(3)}
              >
                Review & Create
              </Button>
            </Box>
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Folder color="primary" />
              Create Project
            </Typography>

            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>{projectName}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {projectDescription}
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                <Typography variant="caption">Framework: <strong>{customStack.framework}</strong></Typography>
                <Typography variant="caption">Language: <strong>{customStack.language}</strong></Typography>
                <Typography variant="caption">Styling: <strong>{customStack.styling}</strong></Typography>
                <Typography variant="caption">Database: <strong>{customStack.database}</strong></Typography>
                <Typography variant="caption">Deployment: <strong>{customStack.deployment}</strong></Typography>
              </Box>

              {securityConfig.envVars.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Environment Variables: {securityConfig.envVars.join(', ')}
                  </Typography>
                </Box>
              )}
            </Paper>

            {!driveProjectFolderId && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                No Google Drive folder selected. Go to Settings to select a project folder first.
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button onClick={() => setActiveStep(2)} startIcon={<ArrowBack />}>
                Back
              </Button>
              <Button
                variant="contained"
                color="success"
                size="large"
                endIcon={isCreating ? <CircularProgress size={20} color="inherit" /> : <Check />}
                onClick={createProject}
                disabled={!driveProjectFolderId || isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Project'}
              </Button>
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ height: '100%', bgcolor: 'background.default', overflow: 'auto' }}>
      <Box sx={{ maxWidth: 700, mx: 'auto', p: 4 }}>
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>
          New Project
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Let AI help you set up the perfect tech stack
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Paper sx={{ p: 4 }}>
          {renderStepContent()}
        </Paper>

        <Button
          sx={{ mt: 3 }}
          onClick={() => setView('chat')}
        >
          Cancel
        </Button>
      </Box>
    </Box>
  );
}
