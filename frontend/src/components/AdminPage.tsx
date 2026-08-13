import { useState, useEffect, FormEvent } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import toast from 'react-hot-toast'
import { API_BASE, fetchFolderContents } from '../utils/api'
import { DriveFile } from '../types'

export default function AdminPage() {
    const [adminToken, setAdminToken] = useState<string | null>(() => localStorage.getItem('admin_token'))
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
    const [checkingAuth, setCheckingAuth] = useState<boolean>(true)

    // Login Form State
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [loginSubmitting, setLoginSubmitting] = useState(false)
    const [loginError, setLoginError] = useState<string | null>(null)

    // Admin Dashboard State
    const [currentPath, setCurrentPath] = useState<string>('')
    const [files, setFiles] = useState<DriveFile[]>([])
    const [loadingFiles, setLoadingFiles] = useState(false)

    // Editor State
    const [selectedFile, setSelectedFile] = useState<string | null>(null)
    const [editorContent, setEditorContent] = useState<string>('')
    const [loadingEditor, setLoadingEditor] = useState(false)
    const [saving, setSaving] = useState(false)

    // Create Modal State
    const [createModalOpen, setCreateModalOpen] = useState(false)
    const [newFilePath, setNewFilePath] = useState('')
    const [newFileContent, setNewFileContent] = useState('')

    // Verify Admin token on mount
    useEffect(() => {
        const verifyAdmin = async () => {
            const token = localStorage.getItem('admin_token')
            if (!token) {
                setIsAuthenticated(false)
                setCheckingAuth(false)
                return
            }

            try {
                const res = await fetch(`${API_BASE}/admin/verify`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                const data = await res.json()
                if (data.authenticated) {
                    setIsAuthenticated(true)
                    setAdminToken(token)
                } else {
                    setIsAuthenticated(false)
                    localStorage.removeItem('admin_token')
                }
            } catch (err) {
                console.error('Failed to verify admin status:', err)
                setIsAuthenticated(false)
            } finally {
                setCheckingAuth(false)
            }
        }

        verifyAdmin()
    }, [])

    // Fetch folder contents when path changes or after login
    const loadFiles = async (dirPath: string) => {
        setLoadingFiles(true)
        try {
            const res = await fetchFolderContents(dirPath, true)
            setFiles(res.data.files || [])
        } catch (err: any) {
            toast.error(err.message || 'Failed to load directory files')
        } finally {
            setLoadingFiles(false)
        }
    }

    useEffect(() => {
        if (isAuthenticated) {
            loadFiles(currentPath)
        }
    }, [isAuthenticated, currentPath])

    // Handle Admin Login
    const handleLoginSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!username.trim() || !password.trim() || loginSubmitting) return

        setLoginSubmitting(true)
        setLoginError(null)

        try {
            const res = await fetch(`${API_BASE}/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim(), password: password.trim() })
            })

            const data = await res.json()
            if (res.ok && data.success && data.token) {
                localStorage.setItem('admin_token', data.token)
                setAdminToken(data.token)
                setIsAuthenticated(true)
                toast.success('Admin authenticated successfully!')
            } else {
                const msg = data.error || 'Invalid admin credentials'
                setLoginError(msg)
                toast.error(msg)
            }
        } catch (err: any) {
            setLoginError('Connection error')
            toast.error('Failed to connect to server')
        } finally {
            setLoginSubmitting(false)
        }
    }

    // Handle Admin Logout
    const handleAdminLogout = async () => {
        const token = adminToken || localStorage.getItem('admin_token')
        if (token) {
            await fetch(`${API_BASE}/admin/logout`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            }).catch(() => {})
        }
        localStorage.removeItem('admin_token')
        setAdminToken(null)
        setIsAuthenticated(false)
        setSelectedFile(null)
        toast.success('Admin logged out')
    }

    // Open file for editing
    const openFileEditor = async (filePath: string) => {
        setSelectedFile(filePath)
        setLoadingEditor(true)
        try {
            const res = await fetch(`${API_BASE}/admin/file-content?path=${encodeURIComponent(filePath)}`, {
                headers: { Authorization: `Bearer ${adminToken}` }
            })
            if (!res.ok) throw new Error('Failed to load file content')
            const data = await res.json()
            setEditorContent(data.content || '')
        } catch (err: any) {
            toast.error('Failed to load file text for editing')
            setEditorContent('')
        } finally {
            setLoadingEditor(false)
        }
    }

    // Save current file to GitHub
    const saveFile = async () => {
        if (!selectedFile || saving) return
        setSaving(true)
        const toastId = toast.loading('Saving and committing to GitHub...')
        try {
            const res = await fetch(`${API_BASE}/admin/save-file`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${adminToken}`
                },
                body: JSON.stringify({
                    path: selectedFile,
                    content: editorContent,
                    commitMessage: `Update ${selectedFile} via /main editor`
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to save')

            toast.success('Saved and synced to GitHub!', { id: toastId })
            loadFiles(currentPath)
        } catch (err: any) {
            toast.error(err.message || 'Error saving file', { id: toastId })
        } finally {
            setSaving(false)
        }
    }

    // Create new file
    const handleCreateFile = async (e: FormEvent) => {
        e.preventDefault()
        if (!newFilePath.trim() || saving) return

        let pathToCreate = newFilePath.trim()
        if (currentPath && !pathToCreate.startsWith(currentPath)) {
            pathToCreate = `${currentPath}/${pathToCreate}`.replace(/\/+/g, '/')
        }

        setSaving(true)
        const toastId = toast.loading('Creating file on GitHub...')
        try {
            const res = await fetch(`${API_BASE}/admin/save-file`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${adminToken}`
                },
                body: JSON.stringify({
                    path: pathToCreate,
                    content: newFileContent,
                    commitMessage: `Create ${pathToCreate} via /main editor`
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to create file')

            toast.success(`Created '${pathToCreate}' on GitHub!`, { id: toastId })
            setCreateModalOpen(false)
            setNewFilePath('')
            setNewFileContent('')
            loadFiles(currentPath)
            openFileEditor(pathToCreate)
        } catch (err: any) {
            toast.error(err.message || 'Error creating file', { id: toastId })
        } finally {
            setSaving(false)
        }
    }

    // Handle File Upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files
        if (!fileList || fileList.length === 0 || saving) return

        const fileToUpload = fileList[0]
        let targetPath = fileToUpload.name
        if (currentPath) {
            targetPath = `${currentPath}/${fileToUpload.name}`.replace(/\/+/g, '/')
        }

        setSaving(true)
        const toastId = toast.loading(`Uploading '${fileToUpload.name}' to GitHub...`)

        try {
            const reader = new FileReader()
            reader.onload = async (event) => {
                try {
                    const result = event.target?.result as string
                    const base64Content = result.split(',')[1]

                    const res = await fetch(`${API_BASE}/admin/upload-file`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${adminToken}`
                        },
                        body: JSON.stringify({
                            path: targetPath,
                            base64Content,
                            commitMessage: `Upload ${targetPath} via /main editor`
                        })
                    })

                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || 'Upload failed')

                    toast.success(`Uploaded '${fileToUpload.name}' to GitHub!`, { id: toastId })
                    loadFiles(currentPath)
                } catch (err: any) {
                    toast.error(err.message || 'Error uploading file', { id: toastId })
                } finally {
                    setSaving(false)
                    if (e.target) e.target.value = ''
                }
            }

            reader.onerror = () => {
                toast.error('Failed to read local file', { id: toastId })
                setSaving(false)
            }

            reader.readAsDataURL(fileToUpload)
        } catch (err: any) {
            toast.error(err.message || 'Upload error', { id: toastId })
            setSaving(false)
        }
    }

    // Delete selected file
    const deleteFile = async (filePath: string) => {
        if (!window.confirm(`Are you sure you want to delete '${filePath}' from GitHub?`)) return
        setSaving(true)
        const toastId = toast.loading('Deleting file from GitHub...')
        try {
            const res = await fetch(`${API_BASE}/admin/delete-file`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${adminToken}`
                },
                body: JSON.stringify({
                    path: filePath,
                    commitMessage: `Delete ${filePath} via /main editor`
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to delete')

            toast.success('Deleted from GitHub!', { id: toastId })
            if (selectedFile === filePath) setSelectedFile(null)
            loadFiles(currentPath)
        } catch (err: any) {
            toast.error(err.message || 'Error deleting file', { id: toastId })
        } finally {
            setSaving(false)
        }
    }

    if (checkingAuth) {
        return (
            <div className="flex min-h-[70vh] items-center justify-center">
                <FontAwesomeIcon icon="spinner" className="h-6 w-6 animate-spin text-gray-500" />
            </div>
        )
    }

    // Admin Login Screen
    if (!isAuthenticated) {
        return (
            <div className="flex min-h-[85vh] items-center justify-center px-4 py-12">
                <div className="w-full max-w-md space-y-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-800 dark:bg-[#18181B]">
                    <div className="text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg">
                            <FontAwesomeIcon icon="user-shield" className="h-7 w-7" />
                        </div>
                        <h2 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                            Repository Admin Editor
                        </h2>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Enter admin credentials from .env to edit repository files directly
                        </p>
                    </div>

                    {loginError && (
                        <div className="flex items-center space-x-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
                            <FontAwesomeIcon icon="exclamation-circle" className="h-4 w-4 shrink-0 text-red-500" />
                            <span>{loginError}</span>
                        </div>
                    )}

                    <form className="space-y-4" onSubmit={handleLoginSubmit}>
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                                Admin Username
                            </label>
                            <input
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="ADMIN_USERNAME from .env"
                                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                                Admin Password
                            </label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="ADMIN_PASSWORD from .env"
                                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loginSubmitting}
                            className="flex w-full justify-center rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loginSubmitting ? 'Authenticating...' : 'Unlock Editor (/main)'}
                        </button>
                    </form>
                </div>
            </div>
        )
    }

    // Admin Editor Dashboard (/main)
    return (
        <div className="mx-auto flex max-w-7xl flex-col px-4 py-6">
            {/* Top Toolbar */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#18181B]">
                <div className="flex items-center space-x-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                        <FontAwesomeIcon icon="edit" className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Web Repository Editor (/main)</h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Directly create, edit, save & commit files to GitHub</p>
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    <label className="flex cursor-pointer items-center space-x-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-blue-700">
                        <FontAwesomeIcon icon="upload" className="h-3.5 w-3.5" />
                        <span>Upload File</span>
                        <input type="file" onChange={handleFileUpload} className="hidden" />
                    </label>
                    <button
                        onClick={() => setCreateModalOpen(true)}
                        className="flex items-center space-x-1.5 rounded-lg bg-green-600 px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-green-700"
                    >
                        <FontAwesomeIcon icon="plus" className="h-3.5 w-3.5" />
                        <span>New File</span>
                    </button>
                    <button
                        onClick={() => openFileEditor('README.md')}
                        className="flex items-center space-x-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        <FontAwesomeIcon icon="book-open" className="h-3.5 w-3.5" />
                        <span>Edit README.md</span>
                    </button>
                    <button
                        onClick={handleAdminLogout}
                        className="flex items-center space-x-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
                    >
                        <FontAwesomeIcon icon="sign-out-alt" className="h-3.5 w-3.5" />
                        <span>Logout</span>
                    </button>
                </div>
            </div>

            {/* Split View: File Manager & Editor */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* File Sidebar */}
                <div className="lg:col-span-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#18181B]">
                    <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Repository Files</span>
                        {currentPath && (
                            <button
                                onClick={() => {
                                    const parts = currentPath.split('/').filter(Boolean)
                                    parts.pop()
                                    setCurrentPath(parts.join('/'))
                                }}
                                className="text-xs text-blue-500 hover:underline"
                            >
                                ← Back Up
                            </button>
                        )}
                    </div>

                    <div className="text-xs text-gray-400 mb-2 truncate">Path: /{currentPath || '(root)'}</div>

                    {loadingFiles ? (
                        <div className="py-8 text-center text-xs text-gray-400">
                            <FontAwesomeIcon icon="spinner" className="h-4 w-4 animate-spin" />
                        </div>
                    ) : (
                        <div className="max-h-[65vh] overflow-y-auto space-y-1 pr-1">
                            {files.map((file) => {
                                const isDir = file.mimeType.includes('folder') || file.mimeType === 'dir'
                                return (
                                    <div
                                        key={file.id || file.path}
                                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors cursor-pointer ${
                                            selectedFile === file.path
                                                ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-900/30 dark:text-blue-400'
                                                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                                        }`}
                                    >
                                        <div
                                            className="flex flex-1 items-center space-x-2 truncate"
                                            onClick={() => {
                                                if (isDir) {
                                                    setCurrentPath(file.path || file.name)
                                                } else {
                                                    openFileEditor(file.path || file.name)
                                                }
                                            }}
                                        >
                                            <FontAwesomeIcon
                                                icon={isDir ? 'folder' : 'file-code'}
                                                className={isDir ? 'text-amber-500' : 'text-blue-400'}
                                            />
                                            <span className="truncate">{file.name}</span>
                                        </div>

                                        {!isDir && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    deleteFile(file.path || file.name)
                                                }}
                                                title="Delete file from GitHub"
                                                className="ml-2 text-gray-400 hover:text-red-500"
                                            >
                                                <FontAwesomeIcon icon="trash-alt" className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Main Code/Text Editor */}
                <div className="lg:col-span-8 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#18181B]">
                    {selectedFile ? (
                        <div className="flex flex-col h-[70vh]">
                            <div className="mb-3 flex items-center justify-between border-b pb-3 dark:border-gray-800">
                                <div>
                                    <h3 className="font-mono text-sm font-bold text-gray-900 dark:text-white">{selectedFile}</h3>
                                    <span className="text-[11px] text-gray-400">Edits will be committed directly to GitHub</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={saveFile}
                                        disabled={saving || loadingEditor}
                                        className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        <FontAwesomeIcon icon={saving ? 'spinner' : 'save'} className={saving ? 'animate-spin' : ''} />
                                        <span>{saving ? 'Saving...' : 'Save & Commit'}</span>
                                    </button>
                                    <button
                                        onClick={() => setSelectedFile(null)}
                                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>

                            {loadingEditor ? (
                                <div className="flex flex-1 items-center justify-center">
                                    <FontAwesomeIcon icon="spinner" className="h-6 w-6 animate-spin text-blue-500" />
                                </div>
                            ) : (
                                <textarea
                                    value={editorContent}
                                    onChange={(e) => setEditorContent(e.target.value)}
                                    placeholder="Type contents here..."
                                    className="flex-1 w-full rounded-xl border border-gray-200 bg-gray-50 p-4 font-mono text-xs leading-relaxed text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
                                />
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[70vh] text-center text-gray-400">
                            <FontAwesomeIcon icon="file-signature" className="h-12 w-12 mb-3 opacity-40" />
                            <p className="text-sm font-medium">Select a file from the sidebar or click "New File" to start editing</p>
                            <button
                                onClick={() => openFileEditor('README.md')}
                                className="mt-4 rounded-xl bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400"
                            >
                                Open README.md
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Create New File Modal */}
            {createModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#18181B]">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Create New File on GitHub</h3>
                        <form onSubmit={handleCreateFile} className="mt-4 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                                    File Path (e.g. README.md or notes/lesson1.md)
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={newFilePath}
                                    onChange={(e) => setNewFilePath(e.target.value)}
                                    placeholder="notes/new-file.md"
                                    className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                                    Initial Content
                                </label>
                                <textarea
                                    rows={5}
                                    value={newFileContent}
                                    onChange={(e) => setNewFileContent(e.target.value)}
                                    placeholder="# New File Heading..."
                                    className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white p-3 font-mono text-xs text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                />
                            </div>

                            <div className="flex justify-end space-x-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setCreateModalOpen(false)}
                                    className="rounded-xl border border-gray-200 px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="rounded-xl bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                                >
                                    {saving ? 'Creating...' : 'Create & Commit'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
