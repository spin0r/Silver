const { Octokit } = require('@octokit/rest');
const cache = require('./cache');
const path = require('path');

const getOctokit = () => {
  return new Octokit({
    auth: process.env.GITHUB_TOKEN
  });
};

const getOwner = () => process.env.GITHUB_OWNER;
const getRepo = () => process.env.GITHUB_REPO;
const getBranch = () => process.env.GITHUB_BRANCH || 'main';

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


const fs = require('fs');
const INDEX_FILE = path.join(__dirname, 'data', 'file_index.json');

function getFolderSizeFromIndex(dirPath) {
    if (!fs.existsSync(INDEX_FILE)) return 0;
    try {
        const indexMap = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
        const prefix = dirPath ? (dirPath.endsWith('/') ? dirPath : dirPath + '/') : '';
        let total = 0;
        for (const p of Object.keys(indexMap)) {
            if (p.startsWith(prefix) && indexMap[p] && typeof indexMap[p].size === 'number') {
                total += indexMap[p].size;
            }
        }
        return total;
    } catch (e) {
        return 0;
    }
}

/**
 * Fetch directory contents from GitHub
 */
async function getContents(dirPath = '') {
  const sanitizedPath = cleanPath(dirPath);
  try {
    const octokit = getOctokit();
    const response = await octokit.rest.repos.getContent({
      owner: getOwner(),
      repo: getRepo(),
      path: sanitizedPath,
      ref: getBranch()
    });

    const items = (Array.isArray(response.data) ? response.data : [response.data])
      .filter(item => item.name !== '.gitkeep');
    
    // Fetch last commit dates in parallel (with concurrency limit)
    const BATCH_SIZE = 10;
    const results = [];
    
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(async (item) => {
        const commitInfo = await getFileInfo(item.path);
        return {
          name: item.name,
          type: item.type === 'dir' ? 'dir' : 'file',
          size: item.type === 'dir' ? getFolderSizeFromIndex(item.path) : (item.size || 0),
          downloadUrl: item.download_url,
          sha: item.sha,
          path: item.path,
          modified: commitInfo ? commitInfo.modified : null
        };
      }));

      results.push(...batchResults);
    }
    
    return results;
  } catch (error) {
    if (error.status === 404) {
      const err = new Error(`Path not found: ${dirPath}`);
      err.status = 404;
      throw err;
    }
    console.error('Error in getContents:', error.message);
    throw error;
  }
}

/**
 * Get last commit date for a file
 */
async function getFileInfo(filePath) {
  const cacheKey = `fileInfo_${filePath}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  try {
    const octokit = getOctokit();
    const response = await octokit.rest.repos.listCommits({
      owner: getOwner(),
      repo: getRepo(),
      path: filePath,
      per_page: 1,
      sha: getBranch()
    });

    if (response.data.length > 0) {
      const commit = response.data[0];
      const info = {
        modified: commit.commit.author.date
      };
      cache.set(cacheKey, info);
      return info;
    }
    return null;
  } catch (error) {
    console.error('Error fetching commit info for', filePath, ':', error.message);
    return null;
  }
}

/**
 * Get full repository tree for search
 */
async function getTree() {
  const cacheKey = 'repo_tree';
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

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
      recursive: "1"
    });

    cache.set(cacheKey, response.data.tree);
    return response.data.tree;
  } catch (error) {
    console.error('Error getting repo tree:', error.message);
    throw error;
  }
}

/**
 * Search files across the repository
 */
async function searchFiles(query) {
  try {
    const tree = await getTree();
    const lowerQuery = query.toLowerCase();
    
    // Search through both files and directories
    const matches = tree.filter(item => {
      const name = path.basename(item.path).toLowerCase();
      if (name === '.gitkeep') return false;
      const fullPath = item.path.toLowerCase();
      return name.includes(lowerQuery) || fullPath.includes(lowerQuery);
    });
    
    return matches.map(item => ({
      name: path.basename(item.path),
      type: item.type === 'blob' ? 'file' : 'dir',
      size: item.size || 0,
      sha: item.sha,
      path: item.path,
      downloadUrl: item.type === 'blob' ? getRawUrl(item.path) : null
    }));
  } catch (error) {
    console.error('Error searching files:', error.message);
    throw error;
  }
}

/**
 * Get raw content of a file using Octokit (keeps auth server-side)
 */
async function getFileContent(filePath) {
  const sanitizedPath = cleanPath(filePath);
  try {
    const owner = getOwner();
    const repo = getRepo();
    const branch = getBranch();
    const token = process.env.GITHUB_TOKEN;

    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${sanitizedPath}`;
    const headers = token ? { Authorization: `token ${token}` } : {};

    const response = await fetch(rawUrl, { headers });
    if (!response.ok) {
      if (response.status === 404) {
        const err = new Error(`File not found: ${filePath}`);
        err.status = 404;
        throw err;
      }
      const err = new Error(`Failed to fetch file: ${response.statusText}`);
      err.status = response.status;
      throw err;
    }

    const arrayBuffer = await response.arrayBuffer();
    const data = Buffer.from(arrayBuffer);

    // Save fetched file to local storage so subsequent local requests serve instantly
    try {
      const STORAGE_DIR = path.join(__dirname, 'data', 'repo_files');
      const localPath = path.join(STORAGE_DIR, sanitizedPath);
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(localPath, data);
    } catch (e) {}

    // Determine content type from extension
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
      '.rar': 'application/x-rar-compressed',
      '.7z': 'application/x-7z-compressed',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    };

    const contentType = contentTypeMap[ext] || response.headers.get('content-type') || 'application/octet-stream';

    return {
      data,
      contentType
    };


  } catch (error) {
    if (error.status === 404) {
      const err = new Error(`File not found: ${filePath}`);
      err.status = 404;
      throw err;
    }
    throw error;
  }
}

/**
 * Construct raw GitHub URL for a file
 */
function getRawUrl(filePath) {
  return `https://raw.githubusercontent.com/${getOwner()}/${getRepo()}/${getBranch()}/${encodeURIComponent(filePath).replace(/%2F/g, '/')}`;
}

module.exports = {
  getContents,
  searchFiles,
  getFileInfo,
  getFileContent,
  getRawUrl
};
