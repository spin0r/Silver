require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getContents: getGitHubContents, searchFiles: searchGitHubFiles, getFileContent: getGitHubFileContent } = require('./github');
const { syncRepository, getLocalContents, getLocalFileContent, searchLocalFiles } = require('./sync');
const { startTelegramBot } = require('./telegram');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Helper to handle async routes
const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Health check endpoints for Render / monitoring
const healthHandler = (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        repo: `${process.env.GITHUB_OWNER || ''}/${process.env.GITHUB_REPO || ''}`
    });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// POST /api/sync — Trigger live repository sync
app.post('/api/sync', asyncHandler(async (req, res) => {
    syncRepository().catch(err => console.error('Sync failed:', err.message));
    res.json({ message: 'Repository sync initiated' });
}));



// GET /api/files?path=
app.get('/api/files', asyncHandler(async (req, res) => {
    const dirPath = req.query.path || '';
    try {
        const contents = getLocalContents(dirPath);
        res.json(contents);
    } catch (err) {
        const contents = await getGitHubContents(dirPath);
        res.json(contents);
    }
}));

// GET /api/search?q=
app.get('/api/search', asyncHandler(async (req, res) => {
    const q = req.query.q;
    if (!q) {
        return res.status(400).json({ error: 'Query parameter q is required' });
    }
    
    try {
        const results = searchLocalFiles(q);
        res.json(results);
    } catch (err) {
        const results = await searchGitHubFiles(q);
        res.json(results);
    }
}));

// GET /api/raw?path= — Serve local file content or fallback to GitHub
app.get('/api/raw', asyncHandler(async (req, res) => {
    const filePath = req.query.path;
    if (!filePath) {
        return res.status(400).json({ error: 'Path parameter is required' });
    }

    const sanitizedPath = String(filePath).replace(/^\/?\d+:\/?/, '').replace(/^\/+/, '');
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${sanitizedPath}`;

    if (req.query.redirect === 'true' || req.query.direct === 'true') {
        return res.redirect(rawUrl);
    }
    
    try {
        let fileInfo;
        try {
            fileInfo = getLocalFileContent(filePath);
        } catch {
            fileInfo = await getGitHubFileContent(filePath);
        }

        const { data, contentType } = fileInfo;
        
        res.removeHeader('X-Frame-Options');
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (contentType) {
            res.setHeader('Content-Type', contentType);
        }
        
        const filename = path.basename(filePath);
        if (req.query.download === 'true') {
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        } else {
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        }
        
        res.send(data);
    } catch (err) {
        console.error('Error serving file:', err.message);
        res.redirect(rawUrl);
    }
}));

// Serve raw file directly for requests with extensions e.g. /MUCLecture_2025_31040397.pdf
app.get('/*.*', asyncHandler(async (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/assets/') || req.path === '/favicon.ico') {
        return next();
    }
    const filePath = req.path.substring(1);
    try {
        let fileInfo;
        try {
            fileInfo = getLocalFileContent(filePath);
        } catch {
            fileInfo = await getGitHubFileContent(filePath);
        }
        const { data, contentType } = fileInfo;
        res.removeHeader('X-Frame-Options');
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (contentType) {
            res.setHeader('Content-Type', contentType);
        }
        const filename = path.basename(filePath);
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        return res.send(data);
    } catch (err) {
        return next();
    }
}));

// Serve frontend static assets if dist exists
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
    console.log(`✨ Serving static frontend from ${frontendDist}`);
    app.use(express.static(frontendDist));
    
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api/') || req.path === '/health') {
            return next();
        }
        res.sendFile(path.join(frontendDist, 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.send('File Index Backend API is running. Build frontend to view web UI.');
    });
}


// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err.message);
    res.status(err.status || 500).json({ 
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
    });
});

app.listen(PORT, async () => {
    console.log(`✅ File Index server running on http://localhost:${PORT}`);
    console.log(`📦 Repo: ${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO} (${process.env.GITHUB_BRANCH || 'main'})`);
    
    // Perform initial repository sync in background
    syncRepository().catch(err => console.error('Sync failed:', err.message));

    // Start Telegram bot listener
    startTelegramBot().catch(err => console.error('Telegram bot error:', err.message));
});

