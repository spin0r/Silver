# 📂 File Index

A web-based file index system similar to Apache's "Index of /" — powered by GitHub as the file storage backend.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?logo=typescript&logoColor=white)

## ✨ Features

- **📁 Directory Browsing** — Navigate files and folders just like Apache's directory listing
- **🔍 Global Search** — Search all files across your entire repository
- **👁️ File Preview** — Inline preview for PDFs, images, videos, and text files
- **🌙 Dark/Light Mode** — Toggle between themes with localStorage persistence
- **📱 Responsive** — Works on desktop, tablet, and mobile
- **⚡ Cached** — In-memory caching with 10-minute TTL to respect GitHub API rate limits
- **🔒 Secure** — GitHub token never exposed to the frontend

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│   React App     │────▶│  Express API     │────▶│  GitHub API     │
│   (Frontend)    │     │  (Backend)       │     │  (Storage)      │
│                 │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │
                         ┌────┴────┐
                         │  Cache  │
                         │ (Memory)│
                         └─────────┘
```

## 📋 Prerequisites

- **Node.js** 18 or higher
- **GitHub Personal Access Token** with `repo` scope (for private repos) or `public_repo` scope (for public repos)
- A GitHub repository containing the files you want to index

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd file-index
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=your-username
GITHUB_REPO=your-repo-name
GITHUB_BRANCH=main
PORT=3001
```

### 3. Install dependencies

```bash
npm run install:all
```

### 4. Run in development mode

```bash
npm run dev
```

This starts:
- **Backend** at `http://localhost:3001`
- **Frontend** at `http://localhost:5173` (proxies API calls to backend)

Open `http://localhost:5173` in your browser.

### 5. Build for production

```bash
npm run build
npm start
```

This builds the frontend and serves everything from the Express server at `http://localhost:3001`.

## 🌐 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_TOKEN` | ✅ | — | GitHub Personal Access Token |
| `GITHUB_OWNER` | ✅ | — | GitHub username or organization |
| `GITHUB_REPO` | ✅ | — | Repository name |
| `GITHUB_BRANCH` | ❌ | `main` | Branch to read files from |
| `PORT` | ❌ | `3001` | Server port |
| `NODE_ENV` | ❌ | `development` | Set to `production` for deployment |

### Creating a GitHub Token

1. Go to [GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens)
2. Click **"Generate new token (classic)"**
3. Give it a descriptive name (e.g., "File Index")
4. Select scopes:
   - `repo` — for private repositories
   - `public_repo` — for public repositories only
5. Click **"Generate token"**
6. Copy the token and paste it into your `.env` file

## 📡 API Endpoints

### `GET /api/files?path=`

Fetches directory contents at the specified path.

**Query Parameters:**
- `path` (optional) — Directory path relative to repo root. Defaults to root (`""`)

**Response:**
```json
[
  {
    "name": "BCA",
    "type": "dir",
    "size": 0,
    "path": "BCA",
    "downloadUrl": null,
    "modified": "2026-08-10T12:00:00Z",
    "sha": "abc123..."
  },
  {
    "name": "OS_Notes.pdf",
    "type": "file",
    "size": 2097152,
    "path": "BCA/OS_Notes.pdf",
    "downloadUrl": "https://raw.githubusercontent.com/...",
    "modified": "2026-08-10T12:00:00Z",
    "sha": "def456..."
  }
]
```

### `GET /api/search?q=`

Searches all files in the repository.

**Query Parameters:**
- `q` (required) — Search query string

**Response:**
```json
[
  {
    "name": "OS_Notes.pdf",
    "type": "file",
    "size": 2097152,
    "path": "BCA/Semester 2/OS_Notes.pdf",
    "downloadUrl": "https://raw.githubusercontent.com/..."
  }
]
```

### `GET /api/raw?path=`

Proxies the raw file content from GitHub. Used for file previews.

**Query Parameters:**
- `path` (required) — File path relative to repo root

## 🚢 Deploy to Render

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/file-index.git
git push -u origin main
```

### 2. Create a Render Web Service

1. Go to [render.com](https://render.com) and sign in
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:

| Setting | Value |
|---------|-------|
| **Name** | `file-index` |
| **Region** | Choose closest to you |
| **Branch** | `main` |
| **Root Directory** | *(leave empty)* |
| **Runtime** | `Node` |
| **Build Command** | `npm run install:all && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

5. Add environment variables:
   - `GITHUB_TOKEN` = your token
   - `GITHUB_OWNER` = your username
   - `GITHUB_REPO` = your repo name
   - `GITHUB_BRANCH` = `main`
   - `NODE_ENV` = `production`

6. Click **"Create Web Service"**

### 3. Access your site

Your site will be available at `https://file-index.onrender.com` (or whatever name you chose).

> **Note:** Free tier services spin down after 15 minutes of inactivity. The first request after inactivity may take 30-60 seconds.

## 🚢 Deploy to Vercel (Alternative)

### 1. Install Vercel CLI

```bash
npm i -g vercel
```

### 2. Create `vercel.json`

```json
{
  "builds": [
    { "src": "backend/server.js", "use": "@vercel/node" },
    { "src": "frontend/package.json", "use": "@vercel/static-build", "config": { "distDir": "dist" } }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "backend/server.js" },
    { "src": "/(.*)", "dest": "frontend/$1" }
  ]
}
```

### 3. Deploy

```bash
vercel --prod
```

Add environment variables in the Vercel dashboard.

## 🗂️ Project Structure

```
file-index/
├── backend/
│   ├── server.js          # Express server & API routes
│   ├── github.js          # GitHub API integration
│   ├── cache.js           # In-memory caching layer
│   └── package.json       # Backend dependencies
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── github.ts         # API client functions
│   │   ├── components/
│   │   │   ├── Breadcrumb.tsx     # Navigation breadcrumb
│   │   │   ├── FileList.tsx       # File/folder table
│   │   │   ├── FilePreview.tsx    # File preview modal
│   │   │   ├── Header.tsx         # Page header
│   │   │   ├── LoadingSpinner.tsx # Loading indicator
│   │   │   ├── ParentDir.tsx      # Parent directory link
│   │   │   ├── SearchBar.tsx      # Search input
│   │   │   ├── SearchResults.tsx  # Search results display
│   │   │   └── ThemeToggle.tsx    # Dark/light mode toggle
│   │   ├── pages/
│   │   │   └── FileBrowser.tsx    # Main page
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css              # All styles
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── .env.example           # Environment variable template
├── .gitignore
├── package.json           # Root scripts
└── README.md              # This file
```

## 🔧 Development

### Running backend only
```bash
npm run dev:backend
```

### Running frontend only
```bash
npm run dev:frontend
```

### Running both concurrently
```bash
npm run dev
```

## 📝 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
