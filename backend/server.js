require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getContents: getGitHubContents, searchFiles: searchGitHubFiles, getFileContent: getGitHubFileContent } = require('./github');
const { syncRepository, getLocalContents, getLocalFileContent, searchLocalFiles } = require('./sync');
const { startTelegramBot } = require('./telegram');
const { buildFolderZip, buildSelectedPathsZip } = require('./zip');

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

// GET /api/zip — Download folder (or root folder if empty) as ZIP
app.get('/api/zip', asyncHandler(async (req, res) => {
    const dirPath = req.query.path || '';
    const { buffer, filename } = await buildFolderZip(dirPath);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
}));

// GET /api/zip/selected — Download multiple selected files/folders as ZIP (via GET)
app.get('/api/zip/selected', asyncHandler(async (req, res) => {
    let paths = [];
    if (req.query.paths) {
        try {
            paths = JSON.parse(req.query.paths);
        } catch (e) {
            paths = String(req.query.paths).split(',');
        }
    }
    const customName = req.query.name || 'selected_files.zip';
    const { buffer, filename } = await buildSelectedPathsZip(paths, customName);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
}));

// POST /api/zip/selected — Download multiple selected files/folders as ZIP (via POST)
app.post('/api/zip/selected', asyncHandler(async (req, res) => {
    const { paths = [], name = 'selected_files.zip' } = req.body || {};
    const { buffer, filename } = await buildSelectedPathsZip(paths, name);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
}));

// Helper to serve raw file content with HTTP Range request support
function sendRawFile(req, res, filePath, data, contentType, isDownload = false) {
    res.removeHeader('X-Frame-Options');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const ext = path.extname(filePath).toLowerCase();
    const finalContentType = contentType || (ext === '.pdf' ? 'application/pdf' : 'application/octet-stream');
    res.setHeader('Content-Type', finalContentType);

    let filename = path.basename(filePath);
    try {
        filename = decodeURIComponent(filename);
    } catch (e) {}

    if (isDownload || req.query.download === 'true') {
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    } else {
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');

    // Handle HTTP Range header for streaming PDFs & videos reliably on Chrome / Safari / Edge
    const range = req.headers.range;
    if (range && data) {
        const total = data.length;
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
        
        if (start >= total || end >= total) {
            res.setHeader('Content-Range', `bytes */${total}`);
            return res.status(416).send('Requested Range Not Satisfiable');
        }
        
        const chunksize = (end - start) + 1;
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', chunksize);
        return res.send(data.slice(start, end + 1));
    }

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', data.length);
    return res.send(data);
}

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
        return sendRawFile(req, res, filePath, fileInfo.data, fileInfo.contentType, req.query.download === 'true');
    } catch (err) {
        console.error('Error serving file:', err.message);
        try {
            const token = process.env.GITHUB_TOKEN;
            const headers = token ? { Authorization: `token ${token}` } : {};
            const ghRes = await fetch(rawUrl, { headers });
            if (ghRes.ok) {
                const ab = await ghRes.arrayBuffer();
                const buf = Buffer.from(ab);
                const ext = path.extname(filePath).toLowerCase();
                const contentType = ext === '.pdf' ? 'application/pdf' : (ghRes.headers.get('content-type') || 'application/octet-stream');
                return sendRawFile(req, res, filePath, buf, contentType, req.query.download === 'true');
            }
        } catch (e) {}
        return res.status(404).json({ error: 'File not found' });
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
        return sendRawFile(req, res, filePath, fileInfo.data, fileInfo.contentType, req.query.download === 'true');
    } catch (err) {
        try {
            const sanitizedPath = String(filePath).replace(/^\/?\d+:\/?/, '').replace(/^\/+/, '');
            const owner = process.env.GITHUB_OWNER;
            const repo = process.env.GITHUB_REPO;
            const branch = process.env.GITHUB_BRANCH || 'main';
            const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${sanitizedPath}`;
            const token = process.env.GITHUB_TOKEN;
            const headers = token ? { Authorization: `token ${token}` } : {};
            const ghRes = await fetch(rawUrl, { headers });
            if (ghRes.ok) {
                const ab = await ghRes.arrayBuffer();
                const buf = Buffer.from(ab);
                const ext = path.extname(filePath).toLowerCase();
                const contentType = ext === '.pdf' ? 'application/pdf' : (ghRes.headers.get('content-type') || 'application/octet-stream');
                return sendRawFile(req, res, filePath, buf, contentType, req.query.download === 'true');
            }
        } catch (e) {}
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

