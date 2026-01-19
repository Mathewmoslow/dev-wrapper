# Studiora Dev

A terminal-based AI development assistant with multi-provider support. Switch between Claude, GPT, and Gemini mid-conversation with context handoff.

## Features

- **Multi-Provider Support** - Anthropic (Claude), OpenAI (GPT-4), Google (Gemini)
- **Provider Switching** - Switch models mid-conversation with automatic context summary
- **Context Management** - Monitor token usage, compact conversations when needed
- **Project Setup Wizard** - Initialize git, GitHub remote, and Vercel in one flow
- **Git Integration** - Auto-installs commit hook to remove AI co-author signatures
- **Streaming Responses** - Real-time streaming from all providers

## Installation

```bash
# Clone and install
git clone https://github.com/mathewmoslow/dev-wrapper.git
cd dev-wrapper
npm install
npm run build
npm link
```

## Configuration

Set API keys in your shell profile (`~/.bashrc`, `~/.zshrc`):

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GEMINI_API_KEY="..."
```

Or create `.env.local` in your project:

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
```

## Usage

```bash
# Start in current directory
studiora-dev

# Start in specific directory
studiora-dev /path/to/project

# Create new project with setup wizard
studiora-dev --new
studiora-dev /path/to/projects --new
```

### Startup Flow

1. **Preflight Checks** - Git status, AI signature hook, configured providers
2. **Provider Selection** - Choose your AI provider (arrow keys or 1/2/3)
3. **Chat** - Start coding with AI assistance

### Chat Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/switch <provider>` | Switch to anthropic, openai, or gemini |
| `/compact` | Summarize conversation to reduce context |
| `/clear` | Clear conversation history |
| `/exit` | Exit the application |

## Project Structure

```
src/
├── index.tsx          # Main entry, CLI setup, Ink app
├── cli.ts             # Command-line argument parsing
├── theme.ts           # Color definitions
├── components/
│   ├── Chat.tsx       # Main chat interface
│   ├── Startup.tsx    # Preflight check screen
│   └── SetupWizard.tsx
├── core/
│   ├── config.ts      # Configuration loading
│   └── conversation.ts # Conversation state management
├── providers/
│   ├── types.ts       # Provider interface definitions
│   ├── anthropic.ts   # Claude API client
│   ├── openai.ts      # GPT API client
│   └── gemini.ts      # Gemini API client
└── modules/
    ├── git/           # Git operations, hooks
    └── setup/         # Project initialization
```

## Tech Stack

- **React + Ink** - Terminal UI framework
- **TypeScript** - Type safety
- **Direct API Calls** - No SDK dependencies, full control over requests

## License

MIT
