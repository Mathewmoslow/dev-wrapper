# Studiora Web - Setup Guide

## Deployed URL
**Production:** https://studiora-web.vercel.app (or your custom domain)

---

## Step 1: Create Google OAuth Credentials (for Google Drive)

You need a Google OAuth Client ID to allow the app to access your Google Drive.

### 1.1 Go to Google Cloud Console
1. Open https://console.cloud.google.com/
2. Select an existing project or create a new one:
   - Click the project dropdown (top left)
   - Click "New Project"
   - Name: `studiora-web` (or anything you'll recognize)
   - Click "Create"

### 1.2 Enable the Google Drive API
1. Go to **APIs & Services > Library**
   - Or direct link: https://console.cloud.google.com/apis/library
2. Search for "Google Drive API"
3. Click on it, then click **Enable**

### 1.3 Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**
   - Or: https://console.cloud.google.com/apis/credentials/consent
2. Select **External** (unless you have Google Workspace)
3. Click "Create"
4. Fill in:
   - **App name:** `Studiora Web`
   - **User support email:** your email
   - **Developer contact email:** your email
5. Click "Save and Continue"
6. **Scopes page:** Click "Add or Remove Scopes"
   - Search and add: `https://www.googleapis.com/auth/drive.file`
   - Search and add: `https://www.googleapis.com/auth/drive.readonly`
   - Click "Update" then "Save and Continue"
7. **Test users:** Add your own email address
8. Click "Save and Continue" → "Back to Dashboard"

### 1.4 Create OAuth Client ID
1. Go to **APIs & Services > Credentials**
   - Or: https://console.cloud.google.com/apis/credentials
2. Click **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Studiora Web Client`
5. **Authorized JavaScript origins:** Add both:
   ```
   https://studiora-web.vercel.app
   http://localhost:5173
   ```
6. **Authorized redirect URIs:** Add both:
   ```
   https://studiora-web.vercel.app
   http://localhost:5173
   ```
7. Click "Create"
8. **Copy the Client ID** - it looks like: `123456789-abcdefg.apps.googleusercontent.com`

---

## Step 2: Create GitHub Personal Access Token

The app uses a Personal Access Token (PAT) for GitHub operations.

### 2.1 Create a Fine-Grained Token (Recommended)
1. Go to https://github.com/settings/tokens?type=beta
2. Click **"Generate new token"**
3. Fill in:
   - **Token name:** `studiora-web`
   - **Expiration:** Choose your preference (90 days, 1 year, or custom)
   - **Repository access:** "All repositories" or select specific ones
4. **Permissions** - Set these to Read & Write:
   - **Repository permissions:**
     - Contents: Read and write
     - Metadata: Read-only (auto-selected)
     - Pull requests: Read and write (if you want PR features)
   - **Account permissions:**
     - (none needed)
5. Click "Generate token"
6. **Copy the token immediately** - you won't see it again!
   - Looks like: `github_pat_...`

### 2.2 Alternative: Classic Token
If you prefer classic tokens:
1. Go to https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. Note: `studiora-web`
4. Select scopes:
   - `repo` (full control of private repositories)
   - `user:email` (optional, for user info)
5. Click "Generate token"
6. Copy immediately

---

## Step 3: Add Environment Variables to Vercel

### Via CLI (Recommended)
Run these commands from the `web/` directory:

```bash
# Add Google Client ID
vercel env add VITE_STUDIORA_GOOGLE_CLIENT_ID

# When prompted:
# - Value: paste your Google Client ID
# - Environments: select all (Production, Preview, Development)
```

### Via Vercel Dashboard
1. Go to https://vercel.com/mathew-moslows-projects/studiora-web/settings/environment-variables
2. Add variable:
   - **Name:** `VITE_STUDIORA_GOOGLE_CLIENT_ID`
   - **Value:** your Google Client ID from Step 1.4
   - **Environments:** Check all (Production, Preview, Development)
3. Click "Save"

---

## Step 4: Redeploy with Environment Variables

After adding env vars, redeploy:

```bash
cd web
vercel deploy --prod
```

Or trigger a redeploy from the Vercel dashboard.

---

## Step 5: Using the App

### First Time Setup
1. Open https://studiora-web.vercel.app
2. Click **"Connect Google Drive"**
   - Sign in with your Google account
   - Grant Drive permissions
3. Enter your **GitHub Personal Access Token**
   - Paste the token from Step 2
4. Go to **Settings**:
   - Add your AI API keys (Anthropic, OpenAI, and/or Gemini)
   - Set your Google Drive project folder ID
   - Select your GitHub repository

### Finding Your Google Drive Folder ID
1. Open Google Drive in browser
2. Navigate to your project folder
3. Look at the URL: `https://drive.google.com/drive/folders/XXXXXX`
4. Copy the `XXXXXX` part - that's your folder ID

---

## Environment Variables Summary

| Variable | Where to Get | Used For |
|----------|--------------|----------|
| `VITE_STUDIORA_GOOGLE_CLIENT_ID` | Google Cloud Console | Google Drive OAuth |
| GitHub PAT | github.com/settings/tokens | Stored in browser localStorage |
| AI API Keys | Provider dashboards | Stored in browser localStorage |

**Note:** Only the Google Client ID is stored in Vercel. All other credentials (GitHub token, AI keys) are stored in your browser's localStorage and never touch any server.

---

## Troubleshooting

### "Google Sign-in Error"
- Check that your redirect URIs in Google Cloud Console match exactly
- Make sure you added both `http://localhost:5173` and your Vercel URL

### "GitHub API Error"
- Verify your PAT hasn't expired
- Check that you granted the required permissions

### "AI Provider Red Status"
- Verify your API key is correct
- Check that your API key has credits/isn't expired

---

## Local Development

```bash
cd web
cp .env.example .env.local
# Edit .env.local with your Google Client ID
npm install
npm run dev
```

Open http://localhost:5173
