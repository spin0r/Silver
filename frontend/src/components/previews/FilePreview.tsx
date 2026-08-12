import { useState, useEffect, Fragment } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Dialog, Transition } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    getFileIcon,
    formatFileSize,
    formatDate
} from '../../utils/fileIcons'
import type { DriveFile } from '../../types'

import toast from 'react-hot-toast'
import DownloadButtonGroup from '../DownloadButtonGroup'
import RenameModal from '../RenameModal'


import VideoPlayer from './VideoPlayer'
import AudioPlayer from './AudioPlayer'
import CodePreview from './CodePreview'
import NotebookPreview from './NotebookPreview'
import MarkdownPreview from './MarkdownPreview'
import Breadcrumb from '../Breadcrumb'
import { PreviewContainer, DownloadBtnContainer } from './Containers'
import { isCodeFile } from '../../utils/getPreviewType'
import { getPreviewUrl } from '../../utils/api'

interface FilePreviewProps {
    file?: DriveFile
    onClose?: () => void
}

const FilePreview = ({ file, onClose }: FilePreviewProps) => {
    const location = useLocation()
    const navigate = useNavigate()
    const [fileData, setFileData] = useState<DriveFile | null>(file || null)
    const [loading, setLoading] = useState(!file)
    const [renameOpen, setRenameOpen] = useState(false)
    const [pdfDark, setPdfDark] = useState(true)



    // If no file prop, fetch from current path
    useEffect(() => {
        if (file) {
            setFileData(file)
            return
        }

        // Fetch file details from path
        const fetchFile = async () => {
            setLoading(true)
            try {
                const pathParts = location.pathname.split('/').filter(Boolean)
                const fileName = decodeURIComponent(pathParts[pathParts.length - 1])

                // Use mock data for local dev
                if (import.meta.env.DEV) {
                    const mockFile = null as any
                    if (mockFile) {
                        setFileData(mockFile)
                        setLoading(false)
                        return
                    }
                }

                // Initial temp data to show something while fetching
                const tempData: DriveFile = {
                    id: 'temp',
                    name: fileName,
                    mimeType: getMimeType(fileName),
                    size: undefined,
                }
                setFileData(tempData)

                // Need to fetch properties from parent folder to get the ID
                // Construct parent path - decode the path to handle URL-encoded spaces/special chars
                const path = decodeURIComponent(location.pathname)
                const decodedPath = decodeURIComponent(path)
                const parentPath = decodedPath.substring(0, decodedPath.lastIndexOf(fileName))



                // Fetch parent folder contents to find this file
                // Import fetchFolderContents dynamically to avoid circular deps if any, 
                // or just rely on the import at top
                const { fetchFolderContents } = await import('../../utils/api')
                const folderData = await fetchFolderContents(parentPath)

                // Debug: Log what the API returned


                // Try multiple matching strategies for the filename
                const decodedFileName = decodeURIComponent(fileName)
                const foundFile = folderData.data.files.find(f => {
                    // Exact match
                    if (f.name === fileName) return true
                    // Decoded match
                    if (f.name === decodedFileName) return true
                    // Case-insensitive match
                    if (f.name.toLowerCase() === fileName.toLowerCase()) return true
                    if (f.name.toLowerCase() === decodedFileName.toLowerCase()) return true
                    return false
                })

                if (foundFile) {
                    setFileData(foundFile)
                } else {
                    // File not found in parent folder, keep temp data
                }
            } catch (err) {
                console.error('Failed to load file details:', err)
                toast.error('Failed to load file details')
            } finally {
                setLoading(false)
            }
        }

        fetchFile()
    }, [file, location.pathname])

    const getMimeType = (filename: string): string => {
        const ext = filename.split('.').pop()?.toLowerCase() || ''
        const mimeMap: Record<string, string> = {
            mp4: 'video/mp4',
            webm: 'video/webm',
            mkv: 'video/x-matroska',
            avi: 'video/x-msvideo',
            mov: 'video/quicktime',
            flv: 'video/x-flv',
            mp3: 'audio/mpeg',
            wav: 'audio/wav',
            flac: 'audio/flac',
            ogg: 'audio/ogg',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            webp: 'image/webp',
            svg: 'image/svg+xml',
            pdf: 'application/pdf',
            txt: 'text/plain',
            md: 'text/markdown',
            json: 'application/json',
            js: 'application/javascript',
            ts: 'application/typescript',
            html: 'text/html',
            css: 'text/css',
            zip: 'application/zip',
            rar: 'application/x-rar-compressed',
            '7z': 'application/x-7z-compressed',
        }
        return mimeMap[ext] || 'application/octet-stream'
    }

    const handleClose = () => {
        if (onClose) {
            onClose()
        } else {
            const pathParts = location.pathname.split('/').filter(Boolean)
            pathParts.pop()
            navigate('/' + pathParts.join('/') + '/')
        }
    }

    const handleRename = async (newName: string) => {
        if (!fileData || !fileData.id || fileData.id === 'temp') {
            toast.error('Cannot rename file: Missing File ID (Try navigating from folder)')
            return
        }

        try {
            
            

            toast.success('File renamed successfully')

            // Construct new path
            const pathParts = location.pathname.split('/').filter(Boolean)
            pathParts[pathParts.length - 1] = encodeURIComponent(newName) // Replace filename

            // Reconstruct path, preserving original trailing slash if it existed (unlikely for files)
            // But usually files don't have trailing slash.
            let newPath = '/' + pathParts.join('/')
            if (location.pathname.endsWith('/')) {
                newPath += '/'
            }

            // If the original path had query params (like ?a=view), they are lost here if we just use pathname.
            // But navigate(newPath) uses the path. 
            // If we are in FilePreview, we might have ?a=view.
            // Let's check if we should add ?a=view back? 
            // The router probably handled ?a=view to get here.
            // If we navigate to just the path, isFilePath checks pathname. 
            // So queries are fine to drop or keep?
            // Actually, FileGridView links to `${basePath}${name}?a=view`.
            // So we should probably keep the search string if it exists.

            if (location.search) {
                newPath += location.search
            }

            // Update URL without full reload, replacing current history entry
            navigate(newPath, { replace: true })

            // Update local state - useEffect will likely fire due to location change, 
            // but setting state here gives immediate feedback
            setFileData(prev => prev ? ({ ...prev, name: newName }) : null)

        } catch (error: any) {
            console.error('Rename failed:', error)
            toast.error(error.message || 'Failed to rename file')
            throw error // Re-throw for modal to handle if needed
        }
    }

    const fileNameLower = fileData?.name?.toLowerCase() || ''
    const isVideo = fileData?.mimeType?.startsWith('video/') || /\.(mp4|webm|mkv|avi|mov|flv)$/i.test(fileNameLower)
    const isAudio = fileData?.mimeType?.startsWith('audio/') || /\.(mp3|wav|flac|ogg|m4a)$/i.test(fileNameLower)
    const isImage = fileData?.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(fileNameLower)
    const isPDF = fileData?.mimeType === 'application/pdf' || fileNameLower.endsWith('.pdf')
    const isMarkdown = /\.(md|markdown)$/i.test(fileNameLower)
    const isCode = fileData ? (isCodeFile(fileData.name) || /\.(txt|json|js|jsx|ts|tsx|py|c|cpp|h|css|html|xml|yaml|yml|sh|java|cs|rs|go|php|rb|sql|env)$/i.test(fileNameLower)) : false
    const isNotebook = fileNameLower.endsWith('.ipynb')

    const downloadUrl = fileData?.link || getPreviewUrl(fileData?.path || location.pathname)


    const DefaultPreviewContent = () => {
        if (!fileData) return null
        return (
            <div className="items-center px-5 py-4 md:flex md:space-x-8">
                <div className="rounded-lg border border-gray-900/10 px-8 py-20 text-center dark:border-gray-500/30">
                    <FontAwesomeIcon
                        icon={getFileIcon(fileData.mimeType, fileData.name.split('.').pop())}
                        className="h-10 w-10 text-gray-500 dark:text-gray-400"
                    />
                    <div className="mt-6 text-sm font-medium line-clamp-3 md:w-28 text-gray-900 dark:text-white">
                        {fileData.name}
                    </div>
                </div>

                <div className="flex flex-col space-y-2 py-4 md:flex-1">
                    <div>
                        <div className="py-2 text-xs font-medium uppercase opacity-80 text-gray-500 dark:text-gray-400">Last modified</div>
                        <div className="text-gray-900 dark:text-white">{fileData.modifiedTime ? formatDate(fileData.modifiedTime) : 'Unavailable'}</div>
                    </div>

                    <div>
                        <div className="py-2 text-xs font-medium uppercase opacity-80 text-gray-500 dark:text-gray-400">File size</div>
                        <div className="text-gray-900 dark:text-white">{fileData.size ? formatFileSize(fileData.size) : 'Unavailable'}</div>
                    </div>

                    <div>
                        <div className="py-2 text-xs font-medium uppercase opacity-80 text-gray-500 dark:text-gray-400">MIME type</div>
                        <div className="text-gray-900 dark:text-white">{fileData.mimeType || 'Unavailable'}</div>
                    </div>
                </div>
            </div>
        )
    }

    const renderPreviewContent = () => {
        if (!fileData) return null

        const { name } = fileData

        if (isVideo) {
            return (
                <VideoPlayer
                    videoUrl={downloadUrl}
                    videoName={name}
                />
            )
        }

        if (isAudio) {
            return (
                <AudioPlayer
                    audioUrl={downloadUrl}
                    fileName={name}
                    modifiedTime={fileData?.modifiedTime}
                    thumbnailUrl={fileData?.thumbnailLink}
                />
            )
        }

        if (isImage) {
            return (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                    className="mx-auto max-h-[70vh]"
                    src={downloadUrl}
                    alt={name}
                />
            )
        }

        if (isPDF) {
            return (
                <div className="flex flex-col space-y-2">
                    <div className="flex justify-end">
                        <button
                            onClick={() => setPdfDark(!pdfDark)}
                            className="flex items-center space-x-1.5 rounded-lg border border-gray-300 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                        >
                            <FontAwesomeIcon icon={pdfDark ? 'sun' : 'moon'} className="h-3.5 w-3.5" />
                            <span>{pdfDark ? 'White PDF View' : 'Dark PDF View'}</span>
                        </button>
                    </div>
                    <div
                        className="h-[75vh] w-full overflow-hidden rounded-lg bg-[#121212] transition-all"
                        style={pdfDark ? { filter: 'invert(0.92) hue-rotate(180deg) contrast(1.1)' } : undefined}
                    >
                        <object
                            data={downloadUrl}
                            type="application/pdf"
                            className="h-full w-full"
                            title={name}
                        >
                            <iframe
                                src={`${downloadUrl}#view=FitH`}
                                className="h-full w-full"
                                title={name}
                            />
                        </object>
                    </div>
                </div>
            )
        }

        if (isMarkdown) {
            return <MarkdownPreview file={fileData} basePath={location.pathname} standalone={true} />
        }

        if (isNotebook) {
            return <NotebookPreview fileUrl={downloadUrl} fileName={name} />
        }

        if (isCode) {
            return <CodePreview fileUrl={downloadUrl} fileName={name} />
        }

        return <DefaultPreviewContent />
    }

    // Video uses custom FileMetadata
    const VideoFileMetadata = () => (
        <div className="flex gap-6 text-sm">
            <div className="min-w-0">
                <div className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                    File Size
                </div>
                <div className="mt-1 whitespace-nowrap text-gray-900 dark:text-white">
                    {fileData?.size ? formatFileSize(fileData.size) : 'Unknown'}
                </div>
            </div>
            <div className="min-w-0">
                <div className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                    MIME Type
                </div>
                <div className="mt-1 whitespace-nowrap font-mono text-gray-900 dark:text-white">
                    {fileData?.mimeType || 'Unknown'}
                </div>
            </div>
            <div className="min-w-0">
                <div className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    Last Modified
                </div>
                <div className="mt-1 whitespace-nowrap text-gray-900 dark:text-white">
                    {fileData?.modifiedTime ? formatDate(fileData.modifiedTime) : 'Unknown'}
                </div>
            </div>
            {fileData?.createdTime && (
                <div>
                    <div className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                        Created
                    </div>
                    <div className="mt-1 text-gray-900 dark:text-white">
                        {formatDate(fileData.createdTime)}
                    </div>
                </div>
            )}
        </div>
    )

    const content = (
        <div className="bg-gray-50 dark:bg-gray-800/50">
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <FontAwesomeIcon icon="spinner" className="h-8 w-8 animate-spin text-gray-500" />
                </div>
            ) : isVideo ? (
                <div className="overflow-hidden rounded-xl border border-gray-200/50 bg-white shadow-lg dark:border-gray-700/50 dark:bg-[#18181B]">
                    <div className="bg-gray-50 dark:bg-gray-800/50">
                        {renderPreviewContent()}
                    </div>
                    {/* Metadata & Actions for Video */}
                    <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                        <VideoFileMetadata />

                        <div className="flex justify-center md:justify-end">
                            <DownloadButtonGroup
                                downloadUrl={downloadUrl}
                                fileName={fileData?.name || 'file'}
                                onGenerateLinkClick={fileData?.id ? async () => {
                                    
                                    const url = ""
                                    await navigator.clipboard.writeText(url)
                                    toast.success('Expiring link copied to clipboard!')
                                } : undefined}
                                onRenameClick={window.UI?.enable_rename && fileData ? () => setRenameOpen(true) : undefined}
                                layout="buttons"
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <PreviewContainer>
                        {renderPreviewContent()}
                    </PreviewContainer>
                    <DownloadBtnContainer>
                        <DownloadButtonGroup
                            downloadUrl={downloadUrl}
                            fileName={fileData?.name || 'file'}
                            onGenerateLinkClick={fileData?.id ? async () => {
                                
                                const url = ""
                                await navigator.clipboard.writeText(url)
                                toast.success('Expiring link copied to clipboard!')
                            } : undefined}
                            onRenameClick={window.UI?.enable_rename && fileData ? () => setRenameOpen(true) : undefined}
                            layout="buttons"
                        />
                    </DownloadBtnContainer>
                </>
            )}
        </div>
    )

    // Modal view (when file prop provided)
    if (file && onClose) {
        return (
            <>

                <RenameModal
                    isOpen={renameOpen}
                    currentName={fileData?.name || ''}
                    onClose={() => setRenameOpen(false)}
                    onRename={handleRename}
                />
                <Transition appear show={true} as={Fragment}>
                    <Dialog as="div" className="relative z-50" onClose={handleClose}>
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-200"
                            enterFrom="opacity-0"
                            enterTo="opacity-100"
                            leave="ease-in duration-150"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                        >
                            <div className="fixed inset-0 bg-black/70" />
                        </Transition.Child>

                        <div className="fixed inset-0 overflow-y-auto">
                            <div className="flex min-h-full items-center justify-center p-4">
                                <Transition.Child
                                    as={Fragment}
                                    enter="ease-out duration-200"
                                    enterFrom="opacity-0 scale-95"
                                    enterTo="opacity-100 scale-100"
                                    leave="ease-in duration-150"
                                    leaveFrom="opacity-100 scale-100"
                                    leaveTo="opacity-0 scale-95"
                                >
                                    <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all dark:bg-[#18181B]">
                                        {/* Header */}
                                        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                                            <Dialog.Title className="truncate pr-4 text-lg font-medium text-gray-900 dark:text-white">
                                                {fileData?.name}
                                            </Dialog.Title>
                                            <button
                                                onClick={handleClose}
                                                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                                            >
                                                <FontAwesomeIcon icon="times" className="h-5 w-5" />
                                            </button>
                                        </div>
                                        {content}
                                    </Dialog.Panel>
                                </Transition.Child>
                            </div>
                        </div>
                    </Dialog>
                </Transition>
            </>
        )
    }

    // Full page view (direct path navigation)
    return (
        <>

            <RenameModal
                isOpen={renameOpen}
                currentName={fileData?.name || ''}
                onClose={() => setRenameOpen(false)}
                onRename={handleRename}
            />
            <div className="mx-auto max-w-6xl px-4 py-4">
                <div className="mb-4">
                    <Breadcrumb />
                </div>

                {content}
            </div>
        </>
    )
}

export default FilePreview
