const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs');
const { Octokit } = require('@octokit/rest');

const STORAGE_DIR = path.join(__dirname, 'data', 'repo_files');
const INDEX_FILE = path.join(__dirname, 'data', 'file_index.json');

function getOctokit() {
  return new Octokit({
    auth: process.env.GITHUB_TOKEN
  });
}

function getOwner() { return process.env.GITHUB_OWNER; }
function getRepo() { return process.env.GITHUB_REPO; }
function getBranch() { return process.env.GITHUB_BRANCH || 'main'; }

function cleanPath(filePath = '') {
  let decoded = filePath;
  try {
    decoded = decodeURIComponent(filePath);
  } catch (e) {}
  return String(decoded)
    .replace(/^\/?\d+:\/?/, '')
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '');
}


/**
 * Ensure storage directory exists
 */
function initStorage() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

/**
 * Recursively sync all repository files to local disk
 */
async function syncRepository() {
  initStorage();
  console.log(`🔄 Starting local repository sync for ${getOwner()}/${getRepo()} (${getBranch()})...`);
  
  try {
    const octokit = getOctokit();
    const branchInfo = await octokit.rest.repos.getBranch({
      owner: getOwner(),
      repo: getRepo(),
      branch: getBranch()
    });
    const treeSha = branchInfo.data.commit.commit.tree.sha;

    const response = await octokit.rest.git.getTree({
      owner: getOwner(),
      repo: getRepo(),
      tree_sha: treeSha,
      recursive: '1'
    });

    const tree = response.data.tree || [];
    const files = tree.filter(item => item.type === 'blob');
    const token = process.env.GITHUB_TOKEN;
    const headers = token ? { Authorization: `token ${token}` } : {};

    console.log(`📦 Found ${files.length} total files in repository. Synchronizing...`);

    // Build a Set of all repo file paths (using forward slashes, normalized)
    const repoFilePaths = new Set(files.map(item => item.path.replace(/\\/g, '/')));

    // --- DELETE local files not in the repo ---
    let deletedCount = 0;
    function deleteOrphans(dir, relBase) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          deleteOrphans(fullPath, relPath);
          // Remove directory if now empty
          try {
            const remaining = fs.readdirSync(fullPath);
            if (remaining.length === 0) {
              fs.rmdirSync(fullPath);
              console.log(`🗑️  Removed empty dir: ${relPath}`);
            }
          } catch (e) {}
        } else {
          if (!repoFilePaths.has(relPath)) {
            fs.unlinkSync(fullPath);
            deletedCount++;
            console.log(`🗑️  Deleted: ${relPath}`);
          }
        }
      }
    }
    deleteOrphans(STORAGE_DIR, '');

    let downloadedCount = 0;
    let skippedCount = 0;
    const fileIndexMap = {};

    const existingIndex = fs.existsSync(INDEX_FILE)
      ? (() => { try { return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8')); } catch(e) { return {}; } })()
      : {};

    for (const item of files) {
      const relPath = item.path;
      const localPath = path.join(STORAGE_DIR, relPath);
      const dir = path.dirname(localPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      let exists = false;
      if (fs.existsSync(localPath)) {
        const stats = fs.statSync(localPath);
        const cached = existingIndex[relPath];
        if (cached && cached.sha === item.sha) {
          exists = true;
        } else if (!item.sha && item.size && stats.size === item.size) {
          exists = true;
        }
      }

      if (exists) {
        skippedCount++;
      } else {
        const cacheBuster = item.sha ? `?v=${item.sha}` : `?t=${Date.now()}`;
        const rawUrl = `https://raw.githubusercontent.com/${getOwner()}/${getRepo()}/${getBranch()}/${encodeURIComponent(relPath).replace(/%2F/g, '/')}${cacheBuster}`;
        try {
          const res = await fetch(rawUrl, { headers, cache: 'no-store' });
          if (res.ok) {
            const ab = await res.arrayBuffer();
            fs.writeFileSync(localPath, Buffer.from(ab));
            downloadedCount++;
          } else {
            console.error(`⚠️ Failed to download ${relPath}: ${res.statusText}`);
          }
        } catch (err) {
          console.error(`⚠️ Error downloading ${relPath}: ${err.message}`);
        }
      }

      const fileStats = fs.existsSync(localPath) ? fs.statSync(localPath) : null;
      fileIndexMap[relPath] = {
        name: path.basename(relPath),
        path: relPath,
        size: fileStats ? fileStats.size : (item.size || 0),
        sha: item.sha,
        modified: fileStats ? fileStats.mtime.toISOString() : new Date().toISOString()
      };
    }

    fs.writeFileSync(INDEX_FILE, JSON.stringify(fileIndexMap, null, 2), 'utf-8');
    console.log(`✅ Local Repository Sync Complete! Downloaded: ${downloadedCount}, Up to date: ${skippedCount}, Deleted: ${deletedCount}. Total files indexed: ${Object.keys(fileIndexMap).length}`);
  } catch (error) {
    console.error(`❌ Sync error:`, error.message);
    throw error;
  }
}

function getDirectorySize(relPath, fullLocalPath, indexMap = {}) {
  let totalSize = 0;
  const prefix = relPath ? (relPath.endsWith('/') ? relPath : relPath + '/') : '';
  let foundInIndex = false;
  
  if (prefix) {
    for (const p of Object.keys(indexMap)) {
      if (p.startsWith(prefix) && indexMap[p] && typeof indexMap[p].size === 'number') {
        totalSize += indexMap[p].size;
        foundInIndex = true;
      }
    }
  }

  if (foundInIndex && totalSize > 0) return totalSize;

  try {
    const entries = fs.readdirSync(fullLocalPath, { withFileTypes: true });
    for (const entry of entries) {
      const childPath = path.join(fullLocalPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += getDirectorySize(relPath ? `${relPath}/${entry.name}` : entry.name, childPath, indexMap);
      } else if (entry.isFile()) {
        const stats = fs.statSync(childPath);
        totalSize += stats.size;
      }
    }
  } catch (e) {}

  return totalSize;
}

/**
 * Get contents of a folder from local disk
 */
function getLocalContents(dirPath = '') {
  initStorage();
  const sanitizedPath = cleanPath(dirPath);
  const targetDir = sanitizedPath ? path.join(STORAGE_DIR, sanitizedPath) : STORAGE_DIR;

  if (!fs.existsSync(targetDir)) {
    const err = new Error(`Path not found: ${dirPath}`);
    err.status = 404;
    throw err;
  }

  const entries = fs.readdirSync(targetDir, { withFileTypes: true })
    .filter(entry => entry.name !== '.gitkeep');
  const indexMap = fs.existsSync(INDEX_FILE) ? JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8')) : {};

  return entries.map(entry => {
    const itemRelPath = sanitizedPath ? `${sanitizedPath}/${entry.name}` : entry.name;
    const fullLocalPath = path.join(targetDir, entry.name);
    const stats = fs.statSync(fullLocalPath);

    if (entry.isDirectory()) {
      const folderSize = getDirectorySize(itemRelPath, fullLocalPath, indexMap);
      return {
        name: entry.name,
        type: 'dir',
        size: folderSize,
        downloadUrl: null,
        sha: itemRelPath,
        path: itemRelPath,
        modified: stats.mtime.toISOString()
      };
    }
 else {
      const metadata = indexMap[itemRelPath] || {};
      return {
        name: entry.name,
        type: 'file',
        size: stats.size,
        downloadUrl: `/api/raw?path=${encodeURIComponent(itemRelPath)}`,

        sha: metadata.sha || itemRelPath,
        path: itemRelPath,
        modified: metadata.modified || stats.mtime.toISOString()
      };
    }
  });
}

/**
 * Get local file content
 */
function getLocalFileContent(filePath) {
  initStorage();
  const sanitizedPath = cleanPath(filePath);
  const localPath = path.join(STORAGE_DIR, sanitizedPath);

  if (!fs.existsSync(localPath) || fs.statSync(localPath).isDirectory()) {
    const err = new Error(`File not found: ${filePath}`);
    err.status = 404;
    throw err;
  }

  const data = fs.readFileSync(localPath);
  const ext = path.extname(filePath).toLowerCase();

  const contentTypeMap = {
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
    '.zip': 'application/zip',
  };

  const contentType = contentTypeMap[ext] || 'application/octet-stream';
  return { data, contentType };
}

/**
 * Search local files
 */
function searchLocalFiles(query) {
  initStorage();
  const lower = query.toLowerCase();
  const indexMap = fs.existsSync(INDEX_FILE) ? JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8')) : {};
  const results = [];

  for (const relPath of Object.keys(indexMap)) {
    const item = indexMap[relPath];
    if (!item || item.name === '.gitkeep') continue;
    if (item.name.toLowerCase().includes(lower) || item.path.toLowerCase().includes(lower)) {
      results.push({
        name: item.name,
        type: 'file',
        size: item.size,
        sha: item.sha,
        path: item.path,
        downloadUrl: `/api/raw?path=${encodeURIComponent(item.path)}`
      });
    }
  }

  return results;
}

module.exports = {
  STORAGE_DIR,
  syncRepository,
  getLocalContents,
  getLocalFileContent,
  searchLocalFiles
};
