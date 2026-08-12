import { DriveFile, FolderListResponse, SearchResponse } from '../types'

export const API_BASE = '/api'


export const DEFAULT_DRIVE = 0

export function getDriveNames(): string[] {
    return ['Repository']
}

export function parsePathInfo(pathname: string): { drive: number; path: string } {
    const cleanPath = pathname.replace(/^\/?\d+:\/?/, '')
    return { drive: 0, path: cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath }
}

// Client-side cache to save Render.com bandwidth (5-minute TTL)
const folderCache = new Map<string, { response: FolderListResponse; timestamp: number }>()
const searchCache = new Map<string, { response: SearchResponse; timestamp: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes TTL

export function clearFolderCache(targetPath?: string) {
    if (targetPath) {
        let normalizedPath = targetPath.replace(/^\/?\d+:\/?/, '')
        if (normalizedPath.startsWith('/')) normalizedPath = normalizedPath.substring(1)
        folderCache.delete(normalizedPath || 'ROOT')
    } else {
        folderCache.clear()
        searchCache.clear()
    }
}

export async function fetchFolderContents(
    path: string,
    forceRefresh = false
): Promise<FolderListResponse> {
    // Strip drive prefix like 0:/ or 0: if present
    let normalizedPath = path.replace(/^\/?\d+:\/?/, '')
    if (normalizedPath.startsWith('/')) {
        normalizedPath = normalizedPath.substring(1)
    }

    const cacheKey = normalizedPath || 'ROOT'
    const cached = folderCache.get(cacheKey)
    const now = Date.now()

    if (!forceRefresh && cached && (now - cached.timestamp < CACHE_TTL_MS)) {
        return cached.response
    }

    const response = await fetch(`${API_BASE}/files?path=${encodeURIComponent(normalizedPath)}`)

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.error || `Failed to fetch: ${response.status}`)
    }

    const data = await response.json()
    
    // Map backend array to DriveFile array
    const files: DriveFile[] = data.map((item: any) => ({
        id: item.sha || item.path,
        name: item.name,
        mimeType: item.type === 'dir' ? 'application/vnd.google-apps.folder' : getMimeType(item.name),
        size: item.size ? item.size.toString() : '0',
        modifiedTime: item.modified,
        link: item.downloadUrl || `${API_BASE}/raw?path=${encodeURIComponent(item.path)}`,
        path: item.path
    }))

    const result: FolderListResponse = {
        nextPageToken: null,
        curPageIndex: 0,
        data: {
            files
        }
    }

    folderCache.set(cacheKey, { response: result, timestamp: now })
    return result
}

export async function searchFiles(
    query: string,
    forceRefresh = false
): Promise<SearchResponse> {
    const cacheKey = query.trim().toLowerCase()
    const cached = searchCache.get(cacheKey)
    const now = Date.now()

    if (!forceRefresh && cached && (now - cached.timestamp < CACHE_TTL_MS)) {
        return cached.response
    }

    const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`)

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.error || `Search failed: ${response.status}`)
    }

    const data = await response.json()
    
    const files: DriveFile[] = data.map((item: any) => ({
        id: item.sha || item.path,
        name: item.name,
        mimeType: item.type === 'dir' ? 'application/vnd.google-apps.folder' : getMimeType(item.name),
        size: item.size ? item.size.toString() : '0',
        modifiedTime: item.modified,
        link: item.downloadUrl || `${API_BASE}/raw?path=${encodeURIComponent(item.path)}`,
        path: item.path
    }))

    const result: SearchResponse = {
        nextPageToken: null,
        curPageIndex: 0,
        data: { files }
    }

    searchCache.set(cacheKey, { response: result, timestamp: now })
    return result
}

export function getDownloadUrl(path: string, filename?: string): string {
    const fullPath = filename ? `${path}/${filename}` : path;
    const normalizedPath = fullPath.replace(/^\/?\d+:\/?/, '').replace(/\/+/g, '/').replace(/^\/+/, '');
    return `/${decodeURIComponent(normalizedPath)}?download=true`;
}

export function getPreviewUrl(path: string, filename?: string): string {
    const fullPath = filename ? `${path}/${filename}` : path;
    const normalizedPath = fullPath.replace(/^\/?\d+:\/?/, '').replace(/\/+/g, '/').replace(/^\/+/, '');
    return `/${decodeURIComponent(normalizedPath)}`;
}

export function getFolderZipUrl(path: string): string {
    const clean = path.replace(/^\/?\d+:\/?/, '').replace(/\/+/g, '/').replace(/^\/+/, '');
    return `${API_BASE}/zip?path=${encodeURIComponent(clean)}`;
}

export function getSelectedZipUrl(paths: string[], name: string = 'selected_files.zip'): string {
    const cleanPaths = paths.map(p => p.replace(/^\/?\d+:\/?/, '').replace(/\/+/g, '/').replace(/^\/+/, ''));
    return `${API_BASE}/zip/selected?paths=${encodeURIComponent(JSON.stringify(cleanPaths))}&name=${encodeURIComponent(name)}`;
}

export function triggerDownload(url: string, fileName?: string) {
    if (!url) return
    let downloadTargetUrl = url
    try {
        const parsed = new URL(url, window.location.origin)
        parsed.searchParams.set('download', 'true')
        downloadTargetUrl = parsed.toString()
    } catch (e) {
        if (!downloadTargetUrl.includes('download=true')) {
            downloadTargetUrl += (downloadTargetUrl.includes('?') ? '&' : '?') + 'download=true'
        }
    }

    const a = document.createElement('a')
    a.href = downloadTargetUrl
    if (fileName) {
        a.download = fileName
    } else {
        a.setAttribute('download', '')
    }
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
}




export function isFolder(mimeType: string): boolean {
    return mimeType === 'application/vnd.google-apps.folder' || mimeType.includes('folder')
}

export function isPDF(mimeType: string): boolean {
    return mimeType === 'application/pdf'
}


export function isFilePath(pathname: string): boolean {
    const cleanPath = pathname.replace(/^\/?\d+:\/?/, '')
    // Files don't end with / and typically have an extension
    return !cleanPath.endsWith('/') && !!cleanPath.split('/').pop()?.includes('.')
}

function getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
        'pdf': 'application/pdf',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'webp': 'image/webp',
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'ogg': 'video/ogg',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'txt': 'text/plain',
        'md': 'text/markdown',
        'json': 'application/json',
        'js': 'text/javascript',
        'ts': 'text/typescript',
        'html': 'text/html',
        'css': 'text/css',
        'xml': 'application/xml',
        'csv': 'text/csv',
        'py': 'text/x-python',
        'java': 'text/x-java',
        'c': 'text/x-c',
        'cpp': 'text/x-c++',
        'h': 'text/x-c',
        'sh': 'text/x-shellscript',
        'zip': 'application/zip',
    };
    return map[ext || ''] || 'application/octet-stream';
}
