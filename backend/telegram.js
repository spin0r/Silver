const { syncRepository } = require('./sync');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let isSyncing = false;
let pollingOffset = 0;

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
            `Available commands:\n` +
            `• <b>/sync</b> - Trigger live sync from GitHub repository\n` +
            `• <b>/stats</b> - View current index statistics\n` +
            `• <b>/help</b> - Show this help message`;
        await sendTelegramMessage(chatId, helpMsg);
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

            const statsMsg = `📊 <b>File Index Statistics</b>\n\n` +
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
                    if (update.message && update.message.text) {
                        handleTelegramCommand(update.message.chat.id, update.message.text)
                            .catch(err => console.error('Error handling Telegram command:', err.message));
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
