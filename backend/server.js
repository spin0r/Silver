const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const crypto = require('crypto');
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

// --- AUTHENTICATION & IP BLOCKING LOGIC ---
// Set ENABLE_PASSWORD=false in .env to disable the password system entirely
const PASSWORD_ENABLED = process.env.ENABLE_PASSWORD !== 'false';

const activeTokens = new Set();
const blockedIPs = new Set(); // IPs blocked after 2 failed attempts
const loginAttempts = new Map(); // IP -> attempt count
const MAX_ATTEMPTS = 2;

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    const rawIp = forwarded ? String(forwarded).split(',')[0].trim() : (req.socket.remoteAddress || 'client');
    return rawIp;
}

function isIpBlocked(ip) {
    if (blockedIPs.has(ip)) return true;
    const count = loginAttempts.get(ip) || 0;
    if (count >= MAX_ATTEMPTS) {
        blockedIPs.add(ip);
        return true;
    }
    return false;
}

function getTokenFromReq(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    if (req.query?.token) return String(req.query.token);
    if (req.query?.auth) return String(req.query.auth);

    if (req.headers.cookie) {
        const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
            const parts = cookie.trim().split('=');
            const key = parts[0];
            const val = parts.slice(1).join('=');
            if (key && val) acc[key] = decodeURIComponent(val);
            return acc;
        }, {});
        if (cookies.auth_token) return cookies.auth_token;
    }
    return null;
}

// Early IP Blocking Middleware for API routes (except health checks and static frontend UI)
app.use((req, res, next) => {
    // If password system is disabled, skip all IP-blocking checks
    if (!PASSWORD_ENABLED) return next();

    if (req.path === '/health' || req.path === '/api/health') {
        return next();
    }
    const isApiRoute = req.path.startsWith('/api/');
    const isStaticAsset = req.path.startsWith('/assets/') || 
                          req.path === '/favicon.ico' || 
                          req.path === '/favicon.svg' || 
                          req.path === '/icons.svg';

    if (!isApiRoute && (isStaticAsset || !path.extname(req.path))) {
        return next();
    }

    const ip = getClientIp(req);
    if (isIpBlocked(ip)) {
        return res.status(403).json({
            error: 'Access Denied: Your IP address has been blocked due to 2 failed password attempts.',
            isBlocked: true,
            attemptsLeft: 0
        });
    }
    next();
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
    const ip = getClientIp(req);

    if (isIpBlocked(ip)) {
        return res.status(403).json({
            error: 'Access Denied: Your IP address has been blocked due to 2 failed password attempts.',
            isBlocked: true,
            attemptsLeft: 0
        });
    }

    const { password } = req.body || {};
    const expectedPassword = process.env.SITE_PASSWORD !== undefined ? process.env.SITE_PASSWORD : 'admin';

    if (password === expectedPassword) {
        loginAttempts.delete(ip);
        blockedIPs.delete(ip);
        const token = crypto.randomBytes(32).toString('hex');
        activeTokens.add(token);
        res.setHeader('Set-Cookie', `auth_token=${token}; Path=/; SameSite=Lax; Max-Age=2592000`);
        return res.json({ success: true, token, attemptsLeft: MAX_ATTEMPTS, isBlocked: false });
    }

    const currentCount = (loginAttempts.get(ip) || 0) + 1;
    loginAttempts.set(ip, currentCount);

    if (currentCount >= MAX_ATTEMPTS) {
        blockedIPs.add(ip);
        return res.status(403).json({
            error: 'Access Denied: Your IP address has been blocked after 2 failed password attempts.',
            isBlocked: true,
            attemptsLeft: 0
        });
    } else {
        return res.status(401).json({
            error: 'Incorrect password. 1 try remaining before IP block.',
            attemptsLeft: MAX_ATTEMPTS - currentCount,
            isBlocked: false
        });
    }
});

// GET /api/auth/verify
app.get('/api/auth/verify', (req, res) => {
    // If password system is disabled, report as authenticated immediately
    if (!PASSWORD_ENABLED) {
        return res.json({
            authenticated: true,
            passwordEnabled: false,
            isBlocked: false,
            attemptsLeft: 2
        });
    }

    const token = getTokenFromReq(req);
    const ip = getClientIp(req);
    const blocked = isIpBlocked(ip);

    const isValid = Boolean(token && activeTokens.has(token));
    res.json({
        authenticated: isValid,
        passwordEnabled: true,
        isBlocked: blocked,
        attemptsLeft: blocked ? 0 : (MAX_ATTEMPTS - (loginAttempts.get(ip) || 0))
    });
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
    const token = getTokenFromReq(req) || req.body?.token;
    if (token) activeTokens.delete(token);
    res.setHeader('Set-Cookie', 'auth_token=; Path=/; Max-Age=0');
    res.json({ success: true });
});

// Auth protection middleware for API endpoints and repo raw files
app.use((req, res, next) => {
    // If password system is disabled, allow all requests through
    if (!PASSWORD_ENABLED) return next();

    if (req.path === '/health' || req.path === '/api/health' || req.path.startsWith('/api/auth/')) {
        return next();
    }

    const isApiRoute = req.path.startsWith('/api/');
    const isStaticAsset = req.path.startsWith('/assets/') || 
                          req.path === '/favicon.ico' || 
                          req.path === '/favicon.svg' || 
                          req.path === '/icons.svg';

    if (isStaticAsset) {
        return next();
    }

    const token = getTokenFromReq(req);
    const isAuthenticated = Boolean(token && activeTokens.has(token));

    if (isAuthenticated) {
        return next();
    }

    // For unauthenticated requests to non-API routes (direct file URLs or SPA pages)
    if (!isApiRoute) {
        const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
        // If the browser navigation accepts HTML or isn't requesting a direct binary download
        if (acceptsHtml || req.query.download !== 'true') {
            const frontendDist = path.join(__dirname, '../frontend/dist');
            if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
                return res.sendFile(path.join(frontendDist, 'index.html'));
            }
        }
    }

    return res.status(401).json({ error: 'Unauthorized: Login required' });
});

// POST /api/sync — Trigger live repository sync
app.post('/api/sync', asyncHandler(async (req, res) => {
    await syncRepository();
    res.json({ success: true, message: 'Repository synced successfully' });
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

const { Readable } = require('stream');
const { STORAGE_DIR } = require('./sync');

function getMimeContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.ogg': 'video/ogg',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.txt': 'text/plain; charset=utf-8',
        '.md': 'text/markdown; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.ts': 'text/typescript; charset=utf-8',
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.xml': 'application/xml; charset=utf-8',
        '.csv': 'text/csv; charset=utf-8',
        '.py': 'text/x-python; charset=utf-8',
        '.java': 'text/x-java; charset=utf-8',
        '.c': 'text/x-c; charset=utf-8',
        '.cpp': 'text/x-c++; charset=utf-8',
        '.h': 'text/x-c; charset=utf-8',
        '.sh': 'text/x-shellscript; charset=utf-8',
        '.yml': 'text/yaml; charset=utf-8',
        '.yaml': 'text/yaml; charset=utf-8',
        '.zip': 'application/zip'
    };
    return map[ext] || 'application/octet-stream';
}

// Helper to stream raw file content efficiently (disk streaming with Range support, or GitHub streaming fallback)
async function serveFileStream(req, res, rawFilePath) {
    if (!rawFilePath) {
        return res.status(400).json({ error: 'Path parameter is required' });
    }

    let filePath = rawFilePath;
    try {
        filePath = decodeURIComponent(rawFilePath);
    } catch (e) {}

    const sanitizedPath = String(filePath).replace(/^\/?\d+:\/?/, '').replace(/^\/+/, '');
    const localPath = path.join(STORAGE_DIR, sanitizedPath);
    const ext = path.extname(sanitizedPath).toLowerCase();
    const isDownload = req.query.download === 'true';

    res.removeHeader('X-Frame-Options');
    res.setHeader('Access-Control-Allow-Origin', '*');

    let filename = path.basename(sanitizedPath);
    const disposition = isDownload ? 'attachment' : 'inline';
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(filename)}"`);

    if (['.md', '.txt', '.json', '.yml', '.yaml', '.html'].includes(ext) || req.query.t || req.query.v || req.query._t) {
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else {
        res.setHeader('Cache-Control', 'public, max-age=86400');
    }

    // 1. Fast local disk stream using Express res.sendFile (Zero memory buffer, native Range request support for PDFs/Videos)
    if (fs.existsSync(localPath) && !fs.statSync(localPath).isDirectory()) {
        const contentType = getMimeContentType(sanitizedPath);
        res.setHeader('Content-Type', contentType);
        return res.sendFile(localPath, { dotfiles: 'allow' }, (err) => {
            if (err && !res.headersSent) {
                console.error(`Error sending file ${localPath}:`, err.message);
                res.status(err.status || 500).end();
            }
        });
    }

    // 2. Fallback: Stream directly from GitHub raw URL while caching to local disk in background
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';
    const encodedGitHubPath = sanitizedPath.split('/').map(encodeURIComponent).join('/');
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodedGitHubPath}`;

    if (req.query.redirect === 'true' || req.query.direct === 'true') {
        return res.redirect(rawUrl);
    }

    try {
        const token = process.env.GITHUB_TOKEN;
        const headers = token ? { Authorization: `token ${token}` } : {};
        const ghRes = await fetch(rawUrl, { headers });

        if (!ghRes.ok) {
            return res.status(ghRes.status || 404).json({ error: 'File not found' });
        }

        const contentType = ext === '.pdf' ? 'application/pdf' : (ghRes.headers.get('content-type') || getMimeContentType(sanitizedPath));
        res.setHeader('Content-Type', contentType);
        const contentLength = ghRes.headers.get('content-length');
        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }
        res.setHeader('Accept-Ranges', 'bytes');

        // Prepare directory for local caching
        try {
            const dir = path.dirname(localPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        } catch (e) {}

        if (ghRes.body) {
            const nodeStream = Readable.fromWeb(ghRes.body);
            try {
                const fileWriteStream = fs.createWriteStream(localPath);
                fileWriteStream.on('error', (e) => console.error('Cache write error:', e.message));
                nodeStream.pipe(fileWriteStream);
            } catch (e) {}
            return nodeStream.pipe(res);
        } else {
            const ab = await ghRes.arrayBuffer();
            const buf = Buffer.from(ab);
            try { fs.writeFileSync(localPath, buf); } catch (e) {}
            return res.send(buf);
        }
    } catch (err) {
        console.error('Error fetching stream from GitHub:', err.message);
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Failed to fetch file stream' });
        }
    }
}

// GET /api/raw?path= — Serve local file content or stream fallback from GitHub
app.get('/api/raw', asyncHandler(async (req, res) => {
    return serveFileStream(req, res, req.query.path);
}));

// Serve raw file directly or render SPA for browser navigation e.g. /Lesson 04.pdf
app.get('/*.*', asyncHandler(async (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/assets/') || req.path === '/favicon.ico') {
        return next();
    }

    // If request comes from browser page navigation (Accept: text/html), serve SPA index.html
    const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
    if (acceptsHtml && req.query.raw !== 'true' && req.query.download !== 'true') {
        const frontendDist = path.join(__dirname, '../frontend/dist');
        if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
            return res.sendFile(path.join(frontendDist, 'index.html'));
        }
    }

    const filePath = req.path.substring(1);
    return serveFileStream(req, res, filePath);
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
    console.log(`🔒 Password system: ${PASSWORD_ENABLED ? 'ENABLED' : 'DISABLED (open access)'}`);
    
    // Perform initial repository sync in background
    syncRepository().catch(err => console.error('Sync failed:', err.message));

    // Start Telegram bot listener
    startTelegramBot().catch(err => console.error('Telegram bot error:', err.message));
});

