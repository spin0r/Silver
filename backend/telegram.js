const { syncRepository } = require('./sync');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let isSyncing = false;
let pollingOffset = 0;

// Per-chat current working directory session state
const userCurrentDir = new Map();

function getCurrentDir(chatId) {
    return userCurrentDir.get(String(chatId)) || '';
}

function resolvePath(chatId, inputPath = '') {
    const current = getCurrentDir(chatId);
    let target = inputPath.trim().replace(/\\/g, '/');

    if (!target || target === '/' || target.toLowerCase() === 'root' || target.toLowerCase() === '~') {
        return '';
    }

    if (target === '..') {
        if (!current) return '';
        const parts = current.split('/');
        parts.pop();
        return parts.join('/');
    }

    if (target.startsWith('..')) {
        const currentParts = current ? current.split('/') : [];
        const inputParts = target.split('/');
        for (const part of inputParts) {
            if (part === '..') {
                if (currentParts.length > 0) currentParts.pop();
            } else if (part && part !== '.') {
                currentParts.push(part);
            }
        }
        return currentParts.join('/');
    }

    if (target.startsWith('/')) {
        return target.replace(/^\/+/, '');
    }

    return current ? `${current}/${target}` : target;
}

/**
 * Send a message via Telegram Bot API
 */
async function sendTelegramMessage(chatId, text) {
    if (!process.env.TELEGRAM_BOT_TOKEN) return;
    try {
        const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML'
            })
        });
    } catch (err) {
        console.error('❌ Failed to send Telegram message:', err.message);
    }
}

/**
 * Download a file from Telegram API by file_id
 */
async function downloadTelegramFile(fileId) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const data = await res.json();
    if (!data.ok || !data.result || !data.result.file_path) {
        throw new Error(data.description || 'Failed to get file path from Telegram');
    }
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${data.result.file_path}`;
    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) {
        throw new Error(`Failed to download file from Telegram (${fileRes.status})`);
    }
    const arrayBuffer = await fileRes.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

/**
 * Clean & determine target filename/filepath from caption or default file_name
 */
function getFilenameFromCaption(caption, defaultName) {
    if (!caption || !caption.trim()) {
        return defaultName;
    }
    let name = caption.trim();
    const defaultExt = path.extname(defaultName);
    const captionExt = path.extname(name);
    if (!captionExt && defaultExt) {
        name += defaultExt;
    }
    return name;
}

/**
 * Save file to local storage directory and update file_index.json
 */
function saveFileToLocalAndIndex(relPath, buffer) {
    const STORAGE_DIR = path.join(__dirname, 'data', 'repo_files');
    const INDEX_FILE = path.join(__dirname, 'data', 'file_index.json');

    const cleanRelPath = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const fullPath = path.join(STORAGE_DIR, cleanRelPath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, buffer);

    let indexMap = {};
    if (fs.existsSync(INDEX_FILE)) {
        try {
            indexMap = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
        } catch (e) {}
    }

    const stats = fs.statSync(fullPath);
    indexMap[cleanRelPath] = {
        name: path.basename(cleanRelPath),
        path: cleanRelPath,
        size: stats.size,
        modified: new Date().toISOString()
    };

    fs.writeFileSync(INDEX_FILE, JSON.stringify(indexMap, null, 2), 'utf-8');
    return { fullPath, cleanRelPath, size: stats.size };
}

/**
 * Commit uploaded file to GitHub repository on target branch (default 'main')
 */
async function commitFileToGitHub(relPath, buffer) {
    if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_OWNER || !process.env.GITHUB_REPO) {
        throw new Error('GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO environment variables are missing');
    }
    const { Octokit } = require('@octokit/rest');
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';

    let sha;
    try {
        const existing = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: relPath,
            ref: branch
        });
        if (existing.data && !Array.isArray(existing.data)) {
            sha = existing.data.sha;
        }
    } catch (e) {}

    await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: relPath,
        message: `Upload ${path.basename(relPath)} via Telegram Bot`,
        content: buffer.toString('base64'),
        branch,
        ...(sha ? { sha } : {})
    });
    return true;
}

/**
 * Handle incoming Telegram bot command
 */
async function handleTelegramCommand(chatId, text) {
    const command = text.trim().split(' ')[0].toLowerCase();

    // Security check if ALLOWED_CHAT_ID is set
    if (ALLOWED_CHAT_ID && String(chatId) !== String(ALLOWED_CHAT_ID)) {
        console.log(`⚠️ Telegram command from unauthorized chat ${chatId} ignored.`);
        await sendTelegramMessage(chatId, '⚠️ <b>Unauthorized access.</b>');
        return;
    }

    if (command === '/start' || command === '/help') {
        const helpMsg = `🤖 <b>File Index Telegram Bot</b>\n\n` +
            `Available features & commands:\n` +
            `• <b>/cd &lt;folder&gt;</b> - Navigate to a directory (e.g. <code>/cd Notes/IT Law</code> or <code>/cd ..</code> or <code>/cd /</code>)\n` +
            `• <b>/pwd</b> - Show current working directory\n` +
            `• <b>Upload Files</b> - Send any document/photo/video. Saves directly into your active <code>/cd</code> folder!\n` +
            `• <b>/mkdir &lt;path&gt;</b> - Create a new folder (e.g. <code>/mkdir Unit 1</code>)\n` +
            `• <b>/ls [path]</b> - List contents of current or target folder\n` +
            `• <b>/sync</b> - Trigger live sync from GitHub repository\n` +
            `• <b>/stats</b> - View current index statistics\n` +
            `• <b>/help</b> - Show this help message`;
        await sendTelegramMessage(chatId, helpMsg);
        return;
    }

    if (command === '/cd' || command === '/chdir') {
        const targetArg = text.trim().substring(command.length).trim();
        const newDir = resolvePath(chatId, targetArg);
        userCurrentDir.set(String(chatId), newDir);

        const display = newDir ? `<code>${newDir}</code>` : '<code>root (/)</code>';
        await sendTelegramMessage(chatId, `📂 <b>Working directory changed to:</b> ${display}`);
        return;
    }

    if (command === '/pwd') {
        const current = getCurrentDir(chatId);
        const display = current ? `<code>${current}</code>` : '<code>root (/)</code>';
        await sendTelegramMessage(chatId, `📍 <b>Current Working Directory:</b> ${display}`);
        return;
    }

    if (command === '/mkdir' || command === '/createfolder' || command === '/folder') {
        const folderArg = text.trim().substring(command.length).trim();
        if (!folderArg) {
            await sendTelegramMessage(chatId, '⚠️ Please specify a folder name or path.\nExample: <code>/mkdir Notes/Semester 1</code>');
            return;
        }

        try {
            const STORAGE_DIR = path.join(__dirname, 'data', 'repo_files');
            const cleanFolderPath = resolvePath(chatId, folderArg);
            const fullDirPath = path.join(STORAGE_DIR, cleanFolderPath);

            fs.mkdirSync(fullDirPath, { recursive: true });

            // Sync index
            await syncRepository();

            await sendTelegramMessage(chatId, `📁 <b>Folder Created Successfully!</b> 🎉\n\nPath: <code>${cleanFolderPath}</code>`);
        } catch (err) {
            await sendTelegramMessage(chatId, `❌ Failed to create folder: <code>${err.message}</code>`);
        }
        return;
    }

    if (command === '/ls' || command === '/list') {
        const arg = text.trim().substring(command.length).trim();
        const targetDir = arg ? resolvePath(chatId, arg) : getCurrentDir(chatId);
        try {
            const { getLocalContents } = require('./sync');
            const items = getLocalContents(targetDir);
            if (items.length === 0) {
                await sendTelegramMessage(chatId, `📂 Folder <code>${targetDir || 'root'}</code> is empty.`);
                return;
            }
            let listText = `📂 <b>Contents of <code>${targetDir || 'root'}</code></b> (${items.length} items):\n\n`;
            for (const item of items) {
                const icon = item.type === 'dir' ? '📁' : '📄';
                listText += `${icon} <code>${item.name}</code>\n`;
            }
            await sendTelegramMessage(chatId, listText);
        } catch (err) {
            await sendTelegramMessage(chatId, `❌ Error listing directory: <code>${err.message}</code>`);
        }
        return;
    }

    if (command === '/stats' || command === '/status') {
        try {
            const INDEX_FILE = path.join(__dirname, 'data', 'file_index.json');
            const indexMap = fs.existsSync(INDEX_FILE) ? JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8')) : {};
            const fileCount = Object.keys(indexMap).length;
            let totalBytes = 0;
            for (const item of Object.values(indexMap)) {
                totalBytes += (item.size || 0);
            }
            const sizeMB = (totalBytes / (1024 * 1024)).toFixed(2);

            const current = getCurrentDir(chatId);
            const dirDisplay = current ? `<code>${current}</code>` : '<code>root (/)</code>';

            const statsMsg = `📊 <b>File Index Statistics</b>\n\n` +
                `📍 Active Dir: ${dirDisplay}\n` +
                `📦 Repository: <code>${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}</code>\n` +
                `🌿 Branch: <code>${process.env.GITHUB_BRANCH || 'main'}</code>\n` +
                `📄 Total Indexed Files: <b>${fileCount}</b>\n` +
                `💾 Total Size: <b>${sizeMB} MB</b>`;
            await sendTelegramMessage(chatId, statsMsg);
        } catch (err) {
            await sendTelegramMessage(chatId, `❌ Error getting stats: ${err.message}`);
        }
        return;
    }

    if (command === '/sync') {
        if (isSyncing) {
            await sendTelegramMessage(chatId, '⏳ A repository sync is already in progress. Please wait...');
            return;
        }

        isSyncing = true;
        await sendTelegramMessage(chatId, `🔄 <b>Starting GitHub live sync...</b>\nRepository: <code>${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}</code> (${process.env.GITHUB_BRANCH || 'main'})`);

        const startTime = Date.now();
        try {
            await syncRepository();
            const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

            const INDEX_FILE = path.join(__dirname, 'data', 'file_index.json');
            const indexMap = fs.existsSync(INDEX_FILE) ? JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8')) : {};
            const fileCount = Object.keys(indexMap).length;

            const successMsg = `✅ <b>Sync Completed Successfully!</b> 🎉\n\n` +
                `⏱ Time taken: <b>${durationSec}s</b>\n` +
                `📄 Total Files Indexed: <b>${fileCount}</b>\n\n` +
                `Your local file index and native PDF viewer are now up to date.`;
            await sendTelegramMessage(chatId, successMsg);
        } catch (err) {
            console.error('❌ Telegram sync error:', err.message);
            await sendTelegramMessage(chatId, `❌ <b>Sync Failed!</b>\nError: <code>${err.message}</code>`);
        } finally {
            isSyncing = false;
        }
        return;
    }
}

/**
 * Handle incoming Telegram file / media uploads
 */
async function handleTelegramFileUpload(chatId, message) {
    if (ALLOWED_CHAT_ID && String(chatId) !== String(ALLOWED_CHAT_ID)) {
        await sendTelegramMessage(chatId, '⚠️ <b>Unauthorized access.</b>');
        return;
    }

    let fileId, defaultName;
    if (message.document) {
        fileId = message.document.file_id;
        defaultName = message.document.file_name || 'document_' + Date.now();
    } else if (message.photo && message.photo.length > 0) {
        fileId = message.photo[message.photo.length - 1].file_id;
        defaultName = `photo_${Date.now()}.jpg`;
    } else if (message.video) {
        fileId = message.video.file_id;
        defaultName = message.video.file_name || `video_${Date.now()}.mp4`;
    } else if (message.audio) {
        fileId = message.audio.file_id;
        defaultName = message.audio.file_name || `audio_${Date.now()}.mp3`;
    } else if (message.voice) {
        fileId = message.voice.file_id;
        defaultName = `voice_${Date.now()}.ogg`;
    }

    if (!fileId) return;

    // Use caption if provided, else use defaultName
    const parsedFilename = getFilenameFromCaption(message.caption, defaultName);

    // Resolve target path relative to user's active /cd directory
    let targetPath;
    if (parsedFilename.includes('/') || parsedFilename.startsWith('/')) {
        targetPath = resolvePath(chatId, parsedFilename);
    } else {
        const currentDir = getCurrentDir(chatId);
        targetPath = currentDir ? `${currentDir}/${parsedFilename}` : parsedFilename;
    }

    await sendTelegramMessage(chatId, `📥 <b>Downloading file & pushing to GitHub...</b>\nTarget path: <code>${targetPath}</code>`);

    try {
        const buffer = await downloadTelegramFile(fileId);
        const branch = process.env.GITHUB_BRANCH || 'main';

        let githubNote = '';
        if (process.env.GITHUB_TOKEN) {
            try {
                await commitFileToGitHub(targetPath, buffer);
                githubNote = `\n🐙 <b>GitHub Repo:</b> Committed directly to <code>${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}</code> (branch: <code>${branch}</code>)`;
            } catch (githubErr) {
                console.error('⚠️ GitHub commit failed:', githubErr.message);
                if (githubErr.message.includes('Resource not accessible')) {
                    githubNote = `\n⚠️ <b>GitHub Error:</b> Token lacks Write permission.\n💡 <i>Grant "Contents: Read & write" in GitHub Token settings!</i>`;
                } else {
                    githubNote = `\n⚠️ <b>GitHub Error:</b> <code>${githubErr.message}</code>`;
                }
            }
        } else {
            githubNote = `\n⚠️ <b>GitHub Token missing:</b> Saved to local disk`;
        }

        // Save locally & sync index
        const stats = saveFileToLocalAndIndex(targetPath, buffer);
        await syncRepository();

        const sizeFormatted = (stats.size / (1024 * 1024)).toFixed(2) + ' MB';
        const successMsg = `✅ <b>File Uploaded & Pushed to GitHub Repository!</b> 🎉\n\n` +
            `📄 File: <code>${path.basename(stats.cleanRelPath)}</code>\n` +
            `📁 Path: <code>${stats.cleanRelPath}</code>\n` +
            `💾 Size: <b>${sizeFormatted}</b>` + githubNote;

        await sendTelegramMessage(chatId, successMsg);
    } catch (err) {
        console.error('❌ Upload error:', err.message);
        await sendTelegramMessage(chatId, `❌ <b>Upload Failed!</b>\nError: <code>${err.message}</code>`);
    }
}

/**
 * Start Telegram bot polling loop
 */
async function startTelegramBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.log('ℹ️ TELEGRAM_BOT_TOKEN not set in environment. Telegram Bot disabled.');
        return;
    }

    console.log('🤖 Telegram Bot initializing...');

    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const data = await res.json();
        if (!data.ok) {
            console.error('❌ Telegram Bot token invalid:', data.description);
            return;
        }
        console.log(`✅ Telegram Bot active: @${data.result.username} (${data.result.first_name})`);
    } catch (err) {
        console.error('❌ Failed to connect to Telegram API:', err.message);
        return;
    }

    while (true) {
        try {
            const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates?offset=${pollingOffset}&timeout=30`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.ok && Array.isArray(data.result)) {
                for (const update of data.result) {
                    pollingOffset = update.update_id + 1;
                    if (update.message) {
                        const msg = update.message;
                        const chatId = msg.chat.id;

                        // Handle files/photos/documents/audio/video uploads
                        if (msg.document || msg.photo || msg.video || msg.audio || msg.voice) {
                            handleTelegramFileUpload(chatId, msg)
                                .catch(err => console.error('Error handling Telegram file upload:', err.message));
                        }
                        // Handle text commands
                        else if (msg.text) {
                            handleTelegramCommand(chatId, msg.text)
                                .catch(err => console.error('Error handling Telegram command:', err.message));
                        }
                    }
                }
            }
        } catch (err) {
            // Wait 5 seconds on network error before retrying poll
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

module.exports = {
    startTelegramBot,
    sendTelegramMessage
};
