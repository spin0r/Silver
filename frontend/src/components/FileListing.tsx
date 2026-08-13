import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Transition } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import toast from 'react-hot-toast'
import Breadcrumb from './Breadcrumb'
import SwitchLayout from './SwitchLayout'
import FileListView from './FileListView'
import FileGridView from './FileGridView'
import FilePreview from './previews/FilePreview'
import MarkdownPreview from './previews/MarkdownPreview'
import { formatFileSize } from '../utils/fileIcons'
import {
        fetchFolderContents,
    isFilePath as checkIsFilePath,
    DEFAULT_DRIVE
} from '../utils/api'
import type { DriveFile, LayoutType } from '../types'

const FileListing = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const [files, setFiles] = useState<DriveFile[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [layout, setLayout] = useState<LayoutType>(() => {
        return (localStorage.getItem('preferredLayout') as LayoutType) || 'list'
    })
    const [nextPageToken, setNextPageToken] = useState<string | null>(null)
    const [loadingMore, setLoadingMore] = useState(false)
    const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null)
    const [pageIndex, setPageIndex] = useState(0)

    // Parse current path
    const path = decodeURIComponent(location.pathname)

    // Check if current path is a file
    const isFilePath = () => checkIsFilePath(location.pathname)

    // Fetch folder contents
    const fetchFiles = async (pageToken?: string, forceRefresh = false) => {
        if (!pageToken) {
            setLoading(true)
            setPageIndex(0)
        } else {
            setLoadingMore(true)
        }
        setError(null)

        try {
            const data = await fetchFolderContents(path, forceRefresh)

            const fetchedFiles = (data.data?.files || []).filter(f => f.name !== '.gitkeep')

            if (pageToken) {
                setFiles(prev => [...prev, ...fetchedFiles])
                setPageIndex(prev => prev + 1)
            } else {
                setFiles(fetchedFiles)
            }

            setNextPageToken(data.nextPageToken || null)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load files'
            setError(message)
            toast.error('Failed to load folder contents')
        } finally {
            setLoading(false)
            setLoadingMore(false)
        }
    }

    // Refetch when path changes or when repoSynced event is triggered
    useEffect(() => {
        if (!isFilePath()) {
            fetchFiles()
        }
    }, [location.pathname])

    useEffect(() => {
        const handleRepoSynced = () => {
            if (!isFilePath()) {
                fetchFiles(undefined, true)
            }
        }
        window.addEventListener('repoSynced', handleRepoSynced)
        return () => window.removeEventListener('repoSynced', handleRepoSynced)
    }, [location.pathname])


    // Save layout preference
    useEffect(() => {
        localStorage.setItem('preferredLayout', layout)
    }, [layout])


    // Optimistic rename update
    const handleRename = (id: string, newName: string) => {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f))
    }

    // Optimistic delete update
    const handleDelete = (id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id))
    }


    // Check if this is a file view
    if (isFilePath()) {
        return <FilePreview />
    }

    return (
        <>
            {/* White loading strip line fixed at the very top of screen above header */}
            <div className="fixed top-0 left-0 right-0 z-[100] h-[3px] overflow-hidden pointer-events-none">
                <div
                    className={`absolute inset-0 transition-opacity duration-300 ${
                        loading ? 'opacity-100' : 'opacity-0'
                    }`}
                >
                    <div className="animate-strip-line-white-ltr h-full rounded-full" />
                </div>
            </div>

            <div className="mx-auto max-w-6xl px-4 py-4 pb-8 sm:pb-4">
                {/* Header with breadcrumb and layout toggle */}
                <div className="mb-4 flex items-center justify-between">
                    <Breadcrumb />
                    <SwitchLayout layout={layout} setLayout={setLayout} />
                </div>

                {/* Content */}
                <div className="rounded-lg border border-gray-200/50 bg-white shadow-sm dark:border-gray-700/50 dark:bg-[#18181B]">
                    {error && (
                        <div className="py-12 text-center">
                            <FontAwesomeIcon icon="exclamation-triangle" className="mb-4 h-12 w-12 text-red-500" />
                            <p className="text-gray-500">{error}</p>
                            <button
                                onClick={() => fetchFiles()}
                                className="mt-4 rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    {!error && (
                        <Transition
                            appear={true}
                            show={!loading}
                            key={location.pathname}
                            enter="transition-opacity duration-200 ease-out"
                            enterFrom="opacity-0"
                            enterTo="opacity-100"
                            leave="transition-opacity duration-150 ease-in"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                        >
                            <div>
                                {files.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <FontAwesomeIcon icon="folder-open" className="mb-4 h-12 w-12 text-gray-400" />
                                        <p className="text-gray-500">This folder is empty</p>
                                    </div>
                                ) : (
                                    layout === 'list' ? (
                                        <FileListView
                                            files={files}
                                            onFileClick={setSelectedFile}
                                            onRenameSuccess={handleRename}
                                            onDeleteSuccess={handleDelete}
                                        />
                                    ) : (
                                        <FileGridView
                                            files={files}
                                            onFileClick={setSelectedFile}
                                            onRenameSuccess={handleRename}
                                            onDeleteSuccess={handleDelete}
                                        />
                                    )
                                )}
                            </div>
                        </Transition>
                    )}
                    {/* Load more button */}
                    {nextPageToken && (
                        <div className="border-t border-gray-200/50 p-4 text-center dark:border-gray-700/50">
                            <button
                                onClick={() => fetchFiles(nextPageToken)}
                                disabled={loadingMore}
                                className="inline-flex items-center space-x-2 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                                {loadingMore ? (
                                    <>
                                        <FontAwesomeIcon icon="spinner" className="animate-spin" />
                                        <span>Loading...</span>
                                    </>
                                ) : (
                                    <>
                                        <FontAwesomeIcon icon="chevron-down" />
                                        <span>Load more</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* README.md preview */}
                {!loading && files.length > 0 && (() => {
                    const readmeFile = files.find(f => f.name.toLowerCase() === 'readme.md')
                    if (readmeFile) {
                        const currentPath = location.pathname.endsWith('/') ? location.pathname : location.pathname + '/'
                        return <MarkdownPreview file={readmeFile} basePath={currentPath} standalone={false} />
                    }
                    return null
                })()}

                {/* File count */}
                {!loading && files.length > 0 && (
                    <div className="mt-4 text-center text-sm text-gray-500">
                        {files.length} item{files.length !== 1 ? 's' : ''}
                        {nextPageToken && ' (more available)'}
                        {files.reduce((acc, file) => acc + (file.size ? parseInt(file.size) : 0), 0) > 0 && (
                            <>
                                <span className="mx-2">•</span>
                                Total size: {formatFileSize(files.reduce((acc, file) => acc + (file.size ? parseInt(file.size) : 0), 0))}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Preview Modal Overlay */}
            {selectedFile && (
                <FilePreview
                    file={selectedFile}
                    onClose={() => setSelectedFile(null)}
                />
            )}
        </>
    )
}

export default FileListing
