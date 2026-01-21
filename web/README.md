# Studiora Web

Web version of Studiora - AI-powered development from anywhere.

## Features

- **Multi-provider AI Chat**: Switch between Claude (Anthropic), GPT (OpenAI), and Gemini (Google)
- **Google Drive Integration**: Access and edit project files stored in Google Drive
- **GitHub API Integration**: Commit, push, and manage repos without local git
- **Works Anywhere**: No local machine required - just a browser

## Architecture

```
Browser (React App)
    │
    ├── Google Drive API ──→ Your project files (syncs to local)
    │
    ├── GitHub API ──→ Git operations (commits, branches, PRs)
    │
    └── AI APIs ──→ Anthropic / OpenAI / Google
```

## Setup

### 1. Clone and Install

```bash
cd web
npm install
```

### 2. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID
3. Add your Vercel URL (or `http://localhost:5173` for dev) to authorized redirect URIs
4. Copy the Client ID

### 3. Set Environment Variables

Create `.env.local`:

```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

### 4. Run Locally

```bash
npm run dev
```

### 5. Deploy to Vercel

```bash
vercel deploy
```

Then set `VITE_GOOGLE_CLIENT_ID` in Vercel environment variables.

## How It Works

### File Storage
- Your project files live in a Google Drive folder
- When you edit files in the web app, changes save directly to Drive
- Google Drive desktop app syncs to your local machine when it's online

### Git Operations
- Instead of running `git commit` locally, the app uses GitHub's REST API
- Create commits, branches, and PRs directly from the web
- Your local git repo stays in sync because files sync via Drive

### AI Chat
- API keys are stored in your browser's localStorage
- Nothing is sent to any server except the AI providers themselves
- Switch between providers mid-conversation with context handoff

## Limitations

Since this runs entirely in the browser:
- No `npm install` or build commands
- No shell/terminal access
- No local dev server
- Pure file editing + AI chat + git operations

For full functionality, use the CLI version (`studiora-dev`).

## Project Structure

```
web/
├── src/
│   ├── components/     # React UI components
│   ├── lib/           # API integrations (Drive, GitHub)
│   ├── providers/     # AI provider implementations
│   ├── stores/        # Zustand state management
│   └── App.tsx        # Main app component
├── vercel.json        # Vercel deployment config
└── .env.example       # Environment variables template
```
