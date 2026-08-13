const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');
const { getContents: getGitHubContents, getFileContent: getGitHubFileContent } = require('./github');

const STORAGE_DIR = path.join(__dirname, 'data', 'repo_files');

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
 * Add a local file or directory to a JSZip instance recursively.
 */
function addLocalToZip(zip, localPath, zipFolderPrefix = '') {
  if (!fs.existsSync(localPath)) return false;
  const stats = fs.statSync(localPath);

  if (stats.isFile()) {
    if (path.basename(localPath) === '.gitkeep') return false;
    const fileData = fs.readFileSync(localPath);
    zip.file(zipFolderPrefix, fileData);
    return true;
  } else if (stats.isDirectory()) {
    const entries = fs.readdirSync(localPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.gitkeep') continue;
      const entryLocalPath = path.join(localPath, entry.name);
      const entryZipPath = zipFolderPrefix ? `${zipFolderPrefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        addLocalToZip(zip, entryLocalPath, entryZipPath);
      } else if (entry.isFile()) {
        const fileData = fs.readFileSync(entryLocalPath);
        zip.file(entryZipPath, fileData);
      }
    }
    return true;
  }
  return false;
}

/**
 * Fallback to GitHub for remote items if not available locally.
 */
async function addRemotePathToZip(zip, relPath, zipFolderPrefix = '') {
  const sanitizedPath = cleanPath(relPath);
  if (path.basename(sanitizedPath) === '.gitkeep') return;
  try {
    const fileInfo = await getGitHubFileContent(sanitizedPath);
    if (fileInfo && fileInfo.data) {
      const filename = path.basename(sanitizedPath);
      if (filename === '.gitkeep') return;
      const entryZipPath = zipFolderPrefix ? `${zipFolderPrefix}/${filename}` : filename;
      zip.file(entryZipPath, fileInfo.data);
      return;
    }
  } catch (e) {
    try {
      const contents = await getGitHubContents(sanitizedPath);
      for (const item of contents) {
        if (item.name === '.gitkeep') continue;
        const itemZipPath = zipFolderPrefix ? `${zipFolderPrefix}/${item.name}` : item.name;
        if (item.type === 'dir') {
          await addRemotePathToZip(zip, item.path, itemZipPath);
        } else {
          try {
            const fInfo = await getGitHubFileContent(item.path);
            if (fInfo && fInfo.data) {
              zip.file(itemZipPath, fInfo.data);
            }
          } catch (err) {}
        }
      }
    } catch (err) {
      console.error(`Failed to fetch remote path ${relPath} for zip:`, err.message);
    }
  }
}

/**
 * Add a relative path (file or folder) to zip.
 */
async function addPathToZip(zip, relPath, zipFolderPrefix = '') {
  const sanitizedPath = cleanPath(relPath);
  if (path.basename(sanitizedPath) === '.gitkeep') return;
  const localPath = sanitizedPath ? path.join(STORAGE_DIR, sanitizedPath) : STORAGE_DIR;
  
  if (fs.existsSync(localPath)) {
    const stats = fs.statSync(localPath);
    if (stats.isFile()) {
      const filename = path.basename(sanitizedPath);
      if (filename === '.gitkeep') return;
      const targetZipPath = zipFolderPrefix || filename;
      zip.file(targetZipPath, fs.readFileSync(localPath));
    } else if (stats.isDirectory()) {
      const prefix = zipFolderPrefix || (sanitizedPath ? path.basename(sanitizedPath) : '');
      addLocalToZip(zip, localPath, prefix);
    }
  } else {
    await addRemotePathToZip(zip, sanitizedPath, zipFolderPrefix);
  }
}

/**
 * Create a ZIP buffer for an entire directory (or root folder if empty).
 */
async function buildFolderZip(dirPath = '') {
  const sanitizedPath = cleanPath(dirPath);
  const zip = new JSZip();

  const folderName = sanitizedPath ? path.basename(sanitizedPath) : (process.env.GITHUB_REPO || 'root');

  const localPath = sanitizedPath ? path.join(STORAGE_DIR, sanitizedPath) : STORAGE_DIR;
  if (fs.existsSync(localPath)) {
    addLocalToZip(zip, localPath, '');
  } else {
    await addRemotePathToZip(zip, sanitizedPath, '');
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  return {
    buffer,
    filename: `${folderName}.zip`
  };
}

/**
 * Create a ZIP buffer for multiple selected paths.
 */
async function buildSelectedPathsZip(pathsArray = [], customName = 'selected_files.zip') {
  const zip = new JSZip();

  for (const itemPath of pathsArray) {
    if (!itemPath) continue;
    await addPathToZip(zip, itemPath);
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  return {
    buffer,
    filename: customName.endsWith('.zip') ? customName : `${customName}.zip`
  };
}

module.exports = {
  buildFolderZip,
  buildSelectedPathsZip,
  cleanPath
};
