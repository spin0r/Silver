import { Link, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { getFileIcon, formatFileSize, extractEmojiFromFileName } from '../utils/fileIcons'
import { getDownloadUrl, getPreviewUrl, getPdfRawUrl, getRawFileUrl, isFolder, isPDF, triggerDownload, getFolderZipUrl } from '../utils/api'


import type { DriveFile } from '../types'
import toast from 'react-hot-toast'
import { useState } from 'react'
import RenameModal from './RenameModal'
import DeleteModal from './DeleteModal'

interface FileGridViewProps {
    files: DriveFile[]
    onFileClick: (file: DriveFile) => void
    onRenameSuccess?: (id: string, newName: string) => void
    onDeleteSuccess?: (id: string) => void
}

import DownloadButtonGroup from './DownloadButtonGroup'

const FileGridItem = ({
    file,
    onFileClick,
    onRenameClick: _onRenameClick,
    onDeleteClick: _onDeleteClick,
    getItemPath,
    getFileDownloadUrl,
    emojiIcon,
    hasThumbnailFolder
}: {
    file: DriveFile
    onFileClick: (file: DriveFile) => void
    onRenameClick: (file: DriveFile) => void
    onDeleteClick: (file: DriveFile) => void
    getItemPath: (file: DriveFile) => string
    getFileDownloadUrl: (file: DriveFile) => string
    emojiIcon?: string | null
    hasThumbnailFolder: boolean
}) => {

    const location = useLocation()
    const isVideo = file.mimeType.startsWith('video/')
    const isImageFile = file.mimeType.startsWith('image/')

    const getCustomThumbnailUrl = () => {
        if (!isVideo || !hasThumbnailFolder) return null
        const basePath = location.pathname.endsWith('/') ? location.pathname : location.pathname + '/'
        const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
        // Assume the custom thumbnail is a jpg in .thumbnail folder
        return `${basePath}.thumbnail/${encodeURIComponent(fileNameWithoutExt)}.jpg`
    }

    const customThumb = getCustomThumbnailUrl()
    const defaultThumb = file.thumbnailLink || (isImageFile ? getFileDownloadUrl(file) : null)

    // Initial source: Try custom thumb first for videos, otherwise default
    const [imgSrc, setImgSrc] = useState<string | null>(
        isVideo && customThumb ? customThumb : defaultThumb
    )
    const [hasError, setHasError] = useState(false)
    const [usingCustom, setUsingCustom] = useState(isVideo && !!customThumb)

    const handleImageError = () => {
        if (usingCustom && defaultThumb) {
            // Failed custom thumbnail, try default
            setUsingCustom(false)
            setImgSrc(defaultThumb)
        } else {
            // Failed default or no default available -> show icon
            setHasError(true)
        }
    }

    // Reset state if file changes (recycling component)
    if (file.id && imgSrc === null && !hasError && defaultThumb) {
        setImgSrc(defaultThumb)
    }

    return (
        <div
            className="group relative rounded-lg border border-gray-200/50 bg-white transition-all hover:border-gray-300 hover:shadow-md dark:border-gray-700/50 dark:bg-[#18181B] dark:hover:border-gray-600"
        >
            {/* Thumbnail area */}
            {isPDF(file.mimeType) || (file.fileExtension || '').toLowerCase() === 'pdf' || (file.path || file.name).toLowerCase().endsWith('.pdf') ? (
                <a
                    href={getItemPath(file)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                >
                    <div className="relative aspect-square overflow-hidden rounded-t-lg bg-gray-100 dark:bg-[#18181B]">
                        {!hasError && imgSrc ? (
                            <img
                                src={imgSrc}
                                alt={file.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onError={handleImageError}
                            />
                        ) : null}

                        {/* Fallback Icon */}
                        <div className={`fallback-icon flex h-full w-full items-center justify-center ${!hasError && imgSrc ? 'hidden' : ''}`}>
                            {emojiIcon ? (
                                <span className="flex h-full w-full items-center justify-center text-6xl select-none">
                                    {emojiIcon}
                                </span>
                            ) : (
                                <FontAwesomeIcon
                                    icon={getFileIcon(file.mimeType, file.fileExtension)}
                                    className={`h-12 w-12 ${isFolder(file.mimeType) ? 'text-gray-500' : 'text-gray-400'}`}
                                />
                            )}
                        </div>

                        {/* Hover overlay with Preview and Download (ZIP for folders) */}
                        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                                onClick={(e) => {
                                    e.preventDefault()
                                    window.open(getItemPath(file), '_blank', 'noopener,noreferrer')
                                }}
                                className="rounded-full bg-white/90 p-2 text-gray-900 hover:bg-white transition-colors"
                                title="Open PDF in new tab"
                            >
                                <FontAwesomeIcon icon="eye" className="h-4 w-4" />
                            </button>
                            <a
                                href={getFileDownloadUrl(file)}
                                download={file.name}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    triggerDownload(getFileDownloadUrl(file), file.name)
                                }}
                                className="rounded-full bg-white/90 p-2 text-gray-900 hover:bg-white transition-colors"
                                title="Download"
                            >
                                <FontAwesomeIcon icon={['far', 'circle-down']} className="h-4 w-4" />
                            </a>
                        </div>
                    </div>
                </a>
            ) : (
                <Link
                    to={getItemPath(file)}
                    className="block"
                >
                    <div className="relative aspect-square overflow-hidden rounded-t-lg bg-gray-100 dark:bg-[#18181B]">
                        {!hasError && imgSrc ? (
                            <img
                                src={imgSrc}
                                alt={file.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onError={handleImageError}
                            />
                        ) : null}

                        {/* Fallback Icon */}
                        <div className={`fallback-icon flex h-full w-full items-center justify-center ${!hasError && imgSrc ? 'hidden' : ''}`}>
                            {emojiIcon ? (
                                <span className="flex h-full w-full items-center justify-center text-6xl select-none">
                                    {emojiIcon}
                                </span>
                            ) : (
                                <FontAwesomeIcon
                                    icon={getFileIcon(file.mimeType, file.fileExtension)}
                                    className={`h-12 w-12 ${isFolder(file.mimeType) ? 'text-gray-500' : 'text-gray-400'}`}
                                />
                            )}
                        </div>

                        {/* Hover overlay with Preview and Download (ZIP for folders) */}
                        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                            {isFolder(file.mimeType) ? (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        e.preventDefault()
                                        triggerDownload(getFolderZipUrl(file.path || file.name), `${file.name}.zip`)
                                    }}
                                    className="rounded-full bg-white/90 p-2 text-gray-900 hover:bg-white transition-colors"
                                    title="Download Folder as ZIP"
                                >
                                    <FontAwesomeIcon icon={['far', 'circle-down']} className="h-4 w-4" />
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault()
                                            onFileClick(file)
                                        }}
                                        className="rounded-full bg-white/90 p-2 text-gray-900 hover:bg-white transition-colors"
                                        title="Preview"
                                    >
                                        <FontAwesomeIcon icon="eye" className="h-4 w-4" />
                                    </button>
                                    <a
                                        href={getFileDownloadUrl(file)}
                                        download={file.name}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            e.preventDefault()
                                            triggerDownload(getFileDownloadUrl(file), file.name)
                                        }}
                                        className="rounded-full bg-white/90 p-2 text-gray-900 hover:bg-white transition-colors"
                                        title="Download"
                                    >
                                        <FontAwesomeIcon icon={['far', 'circle-down']} className="h-4 w-4" />
                                    </a>
                                </>
                            )}
                        </div>
                    </div>
                </Link>
            )}


            {/* File info */}
            <div className="p-2">
                {isPDF(file.mimeType) || (file.fileExtension || '').toLowerCase() === 'pdf' || (file.path || file.name).toLowerCase().endsWith('.pdf') ? (
                    <a
                        href={getItemPath(file)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-sm font-medium text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                        title={file.name}
                    >
                        {file.name}
                    </a>
                ) : (
                    <Link
                        to={getItemPath(file)}
                        className="block truncate text-sm font-medium text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                        title={file.name}
                    >
                        {file.name}
                    </Link>
                )}

                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {formatFileSize(file.size) || 'Folder'}
                </p>
            </div>
        </div>
    )
}

const FileGridView = ({ files, onFileClick, onRenameSuccess, onDeleteSuccess }: FileGridViewProps) => {
    const location = useLocation()
    const path = decodeURIComponent(location.pathname)

    const handleDeleteClick = (file: DriveFile) => {
        setFileToDelete(file)
        setDeleteModalOpen(true)
    }

    const handleDeleteSubmit = async () => {
        if (!fileToDelete) return

        try {
            /* deleted */
            toast.success('File deleted successfully')
            if (onDeleteSuccess) {
                onDeleteSuccess(fileToDelete.id)
            } else {
                setTimeout(() => window.location.reload(), 500)
            }
        } catch (error) {
            console.error(error)
            toast.error('Failed to delete file')
        }
    }

    // Rename state
    const [renameModalOpen, setRenameModalOpen] = useState(false)
    const [fileToRename, setFileToRename] = useState<DriveFile | null>(null)

    // Delete state
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [fileToDelete, setFileToDelete] = useState<DriveFile | null>(null)

    const getItemPath = (file: DriveFile): string => {
        const isFolderItem = isFolder(file.mimeType)
        const cleanPath = (file.path || file.name).replace(/\/+/g, '/')
        const normalized = cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath
        if (isFolderItem) {
            return `${normalized}/`.replace(/\/+/g, '/')
        }
        if (isPDF(file.mimeType) || (file.fileExtension || '').toLowerCase() === 'pdf' || cleanPath.toLowerCase().endsWith('.pdf')) {
            return getPreviewUrl(cleanPath)
        }

        return `${normalized}?a=view`.replace(/\/+/g, '/')
    }



    const getFileDownloadUrl = (file: DriveFile): string => {
        return file.link || getDownloadUrl(file.path || file.name)
    }


    // Sort: folders first, then files alphabetically
    const sortedFiles = [...files].sort((a, b) => {
        const aIsFolder = isFolder(a.mimeType)
        const bIsFolder = isFolder(b.mimeType)
        if (aIsFolder && !bIsFolder) return -1
        if (!aIsFolder && bIsFolder) return 1
        return a.name.localeCompare(b.name)
    })

    // Check if .thumbnail folder exists in this directory
    const hasThumbnailFolder = files.some(f => isFolder(f.mimeType) && f.name === '.thumbnail')

    const handleRenameClick = (file: DriveFile) => {
        setFileToRename(file)
        setRenameModalOpen(true)
    }

    const onRenameSubmit = async (newName: string) => {
        if (!fileToRename) return

        try {
            /* renamed */
            toast.success('File renamed successfully')
            // Optimistic update
            if (onRenameSuccess) {
                onRenameSuccess(fileToRename.id, newName)
            } else {
                // Fallback if no callback provided
                setTimeout(() => window.location.reload(), 500)
            }
        } catch (error) {
            console.error(error)
            toast.error('Failed to rename file')
            throw error
        }
    }

    return (
        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {sortedFiles.map((file) => {
                const isFolderItem = isFolder(file.mimeType)
                const { emoji } = isFolderItem
                    ? extractEmojiFromFileName(file.name)
                    : { emoji: null }

                return (
                    <FileGridItem
                        key={file.id}
                        file={file}
                        onFileClick={onFileClick}
                        onRenameClick={handleRenameClick}
                        getItemPath={getItemPath}
                        getFileDownloadUrl={getFileDownloadUrl}
                        emojiIcon={emoji}
                        onDeleteClick={handleDeleteClick}
                        hasThumbnailFolder={hasThumbnailFolder}
                    />
                )
            })}
            {/* Rename Modal */}
            <RenameModal
                isOpen={renameModalOpen}
                onClose={() => setRenameModalOpen(false)}
                onRename={onRenameSubmit}
                currentName={fileToRename?.name || ''}
            />

            {/* Delete Modal */}
            <DeleteModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onDelete={handleDeleteSubmit}
                fileName={fileToDelete?.name || ''}
            />
        </div>
    )
}

export default FileGridView
