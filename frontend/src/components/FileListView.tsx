import { useState, useRef, useEffect, MouseEventHandler } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { getFileIcon, formatFileSize, formatDate, extractEmojiFromFileName } from '../utils/fileIcons'
import { getDownloadUrl, getPreviewUrl, getPdfRawUrl, getRawFileUrl, isFolder, isPDF, triggerDownload, getSelectedZipUrl, getFolderZipUrl } from '../utils/api'


import type { DriveFile } from '../types'
import toast from 'react-hot-toast'
import RenameModal from './RenameModal'
import DeleteModal from './DeleteModal'
import DownloadButtonGroup from './DownloadButtonGroup'

const FileHoverIcon = ({ file, isFolderItem, emojiIcon }: { file: DriveFile, isFolderItem: boolean, emojiIcon?: string | null }) => {
    return (
        <div className="w-5 flex-shrink-0 text-center">
            {emojiIcon ? (
                <span className="flex h-5 w-5 items-center justify-center text-base leading-none select-none">
                    {emojiIcon}
                </span>
            ) : (
                <FontAwesomeIcon
                    icon={isFolderItem ? ['far', 'folder'] : getFileIcon(file.mimeType, file.fileExtension)}
                    className={`h-4 w-4 ${isFolderItem ? 'text-gray-500' : 'text-gray-400'}`}
                />
            )}
        </div>
    )
}

// Checkbox component with indeterminate state support
interface CheckboxProps {
    checked: 0 | 1 | 2  // 0: unchecked, 1: indeterminate, 2: checked
    onChange: () => void
    title: string
    indeterminate?: boolean
}

const Checkbox = ({ checked, onChange, title, indeterminate }: CheckboxProps) => {
    const ref = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (ref.current) {
            ref.current.checked = Boolean(checked)
            if (indeterminate) {
                ref.current.indeterminate = checked === 1
            }
        }
    }, [ref, checked, indeterminate])

    const handleClick: MouseEventHandler = (e) => {
        if (ref.current) {
            if (e.target === ref.current) {
                e.stopPropagation()
            } else {
                ref.current.click()
            }
        }
    }

    return (
        <span
            title={title}
            className="inline-flex cursor-pointer items-center rounded p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            onClick={handleClick}
        >
            <input
                className="form-check-input h-4 w-4 cursor-pointer rounded border-gray-300 dark:border-gray-600 dark:bg-[#27272A] accent-blue-600 dark:accent-blue-500"
                type="checkbox"
                value={checked ? '1' : ''}
                ref={ref}
                aria-label={title}
                onChange={onChange}
            />
        </span>
    )

}

interface FileListViewProps {
    files: DriveFile[]
    onFileClick: (file: DriveFile) => void
    onRenameSuccess?: (id: string, newName: string) => void
    onDeleteSuccess?: (id: string) => void
}

const FileListView = ({ files, onFileClick, onRenameSuccess, onDeleteSuccess }: FileListViewProps) => {
    const location = useLocation()
    const path = decodeURIComponent(location.pathname)

    // File selection state
    const [selected, setSelected] = useState<Record<string, boolean>>({})

    // Rename state
    const [renameModalOpen, setRenameModalOpen] = useState(false)
    const [fileToRename, setFileToRename] = useState<DriveFile | null>(null)

    // Delete state
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [fileToDelete, setFileToDelete] = useState<DriveFile | null>(null)

    // Modified date column is always enabled
    const showModified = true


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

    // All files and folders are selectable
    const selectableFiles = sortedFiles

    // Calculate total selection state
    const getSelectionState = (): 0 | 1 | 2 => {
        const selectedIds = selectableFiles.filter(f => selected[f.id])
        if (selectedIds.length === 0) return 0
        if (selectedIds.length === selectableFiles.length) return 2
        return 1
    }

    const totalSelected = getSelectionState()
    const selectedCount = selectableFiles.filter(f => selected[f.id]).length

    // Toggle individual file selection
    const toggleFileSelected = (id: string) => {
        setSelected(prev => {
            if (prev[id]) {
                const next = { ...prev }
                delete next[id]
                return next
            }
            return { ...prev, [id]: true }
        })
    }

    // Toggle all files selection
    const toggleAllSelected = () => {
        if (totalSelected === 2) {
            setSelected({})
        } else {
            const allSelected: Record<string, boolean> = {}
            selectableFiles.forEach(f => { allSelected[f.id] = true })
            setSelected(allSelected)
        }
    }

    // Copy selected files permalinks
    const copySelectedPermalinks = () => {
        const selectedFiles = selectableFiles.filter(f => selected[f.id])
        const urls = selectedFiles.map(f => {
            const fullPath = `${window.location.origin}${getFileDownloadUrl(f)}`
            return fullPath
        }).join('\n')

        navigator.clipboard.writeText(urls).then(() => {
            toast.success(`Copied ${selectedFiles.length} file link(s) to clipboard`)
        }).catch(() => {
            toast.error('Failed to copy links')
        })
    }

    // Download selected files (ZIP for multiple files or folders)
    const downloadSelectedFiles = () => {
        const selectedFiles = selectableFiles.filter(f => selected[f.id])
        if (selectedFiles.length === 0) return

        if (selectedFiles.length === 1 && !isFolder(selectedFiles[0].mimeType)) {
            triggerDownload(getFileDownloadUrl(selectedFiles[0]), selectedFiles[0].name)
        } else if (selectedFiles.length === 1 && isFolder(selectedFiles[0].mimeType)) {
            const folder = selectedFiles[0]
            triggerDownload(getFolderZipUrl(folder.path || folder.name), `${folder.name}.zip`)
            toast.success(`Starting ZIP download for ${folder.name}...`)
        } else {
            toast.success(`Generating ZIP for ${selectedFiles.length} selected item(s)...`)
            const paths = selectedFiles.map(f => f.path || f.name)
            triggerDownload(getSelectedZipUrl(paths, 'selected_files.zip'), 'selected_files.zip')
        }
    }

    // Copy single file link
    const copyFileLink = (file: DriveFile) => {
        const url = `${window.location.origin}${getFileDownloadUrl(file)}`
        navigator.clipboard.writeText(url).then(() => {
            toast.success('Copied file link to clipboard')
        }).catch(() => {
            toast.error('Failed to copy link')
        })
    }

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
                setTimeout(() => window.location.reload(), 500)
            }
        } catch (error) {
            console.error(error)
            toast.error('Failed to rename file')
            throw error // Re-throw for modal to handle loading state if needed
        }
    }



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

    return (
        <div className="rounded bg-white shadow-sm dark:bg-[#18181B] dark:text-gray-100">
            {/* Header */}
            <div className="grid grid-cols-12 items-center px-3 py-2 border-b border-gray-900/10 dark:border-gray-500/30">
                <div className="col-span-12 md:col-span-10 grid grid-cols-10 items-center space-x-2">
                    <div className="col-span-10 md:col-span-6 text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-gray-300">
                        Name
                    </div>
                    <div className="col-span-3 hidden text-xs font-bold uppercase tracking-widest text-gray-600 md:block dark:text-gray-300">
                        Last Modified
                    </div>
                    <div className="col-span-1 hidden text-xs font-bold uppercase tracking-widest text-gray-600 md:block dark:text-gray-300">
                        Size
                    </div>
                </div>
                {/* Header Action & Select Slots (Copy | Download | Checkbox) */}
                <div className="hidden text-xs font-bold uppercase tracking-widest text-gray-600 md:flex md:col-span-2 items-center justify-end dark:text-gray-300">
                    <div className="w-8 flex items-center justify-center">
                        <button
                            title="Copy selected files permalink"
                            className="cursor-pointer rounded p-1.5 hover:bg-gray-300 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent dark:hover:bg-gray-600 disabled:dark:text-gray-600 dark:disabled:hover:bg-transparent transition-colors"
                            disabled={selectedCount === 0}
                            onClick={copySelectedPermalinks}
                        >
                            <FontAwesomeIcon icon={['far', 'copy']} className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="w-8 flex items-center justify-center">
                        <button
                            title="Download selected files"
                            className="cursor-pointer rounded p-1.5 hover:bg-gray-300 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent dark:hover:bg-gray-600 disabled:dark:text-gray-600 dark:disabled:hover:bg-transparent transition-colors"
                            disabled={selectedCount === 0}
                            onClick={downloadSelectedFiles}
                        >
                            <FontAwesomeIcon icon={['far', 'circle-down']} className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="w-8 flex items-center justify-center">
                        <Checkbox
                            checked={totalSelected}
                            onChange={toggleAllSelected}
                            title="Select files"
                            indeterminate={true}
                        />
                    </div>
                </div>
            </div>

            {/* Files */}
            {sortedFiles.map((file) => {
                const isFolderItem = isFolder(file.mimeType)
                const { emoji, cleanName } = isFolderItem
                    ? extractEmojiFromFileName(file.name)
                    : { emoji: null, cleanName: file.name }

                const isPdfFile = isPDF(file.mimeType) || (file.path || file.name).toLowerCase().endsWith('.pdf')
                const targetUrl = getItemPath(file)

                return (
                    <div
                        key={file.id}
                        className="grid grid-cols-12 items-center px-3 transition-all duration-100 hover:bg-gray-100 dark:hover:bg-gray-850"
                    >

                        {isPdfFile ? (
                            <a
                                href={targetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="col-span-12 md:col-span-10"
                            >
                                <div className="grid cursor-pointer grid-cols-10 items-center space-x-2 py-2.5">
                                    <div className="col-span-10 flex items-center space-x-2 truncate md:col-span-6" title={cleanName}>
                                        <FileHoverIcon file={file} isFolderItem={isFolderItem} emojiIcon={emoji} />
                                        <span className="truncate font-medium text-gray-900 dark:text-white">
                                            {cleanName}
                                        </span>
                                    </div>
                                    <div className="col-span-3 hidden flex-shrink-0 font-mono text-sm text-gray-700 md:block dark:text-gray-500">
                                        {formatDate(file.modifiedTime)}
                                    </div>
                                    <div className="col-span-1 hidden flex-shrink-0 truncate font-mono text-sm text-gray-700 md:block dark:text-gray-500">
                                        {formatFileSize(file.size) || '—'}
                                    </div>
                                </div>
                            </a>
                        ) : (
                            <Link
                                to={targetUrl}
                                className="col-span-12 md:col-span-10"
                            >
                                <div className="grid cursor-pointer grid-cols-10 items-center space-x-2 py-2.5">
                                    <div className="col-span-10 flex items-center space-x-2 truncate md:col-span-6" title={cleanName}>
                                        <FileHoverIcon file={file} isFolderItem={isFolderItem} emojiIcon={emoji} />
                                        <span className="truncate font-medium text-gray-900 dark:text-white">
                                            {cleanName}
                                        </span>
                                    </div>
                                    <div className="col-span-3 hidden flex-shrink-0 font-mono text-sm text-gray-700 md:block dark:text-gray-500">
                                        {formatDate(file.modifiedTime)}
                                    </div>
                                    <div className="col-span-1 hidden flex-shrink-0 truncate font-mono text-sm text-gray-700 md:block dark:text-gray-500">
                                        {formatFileSize(file.size) || '—'}
                                    </div>
                                </div>
                            </Link>

                        )}

                        {/* Row Action & Select Slots (Preview/Spacer | Download/ZIP | Checkbox) */}
                        <div className="hidden text-gray-700 md:flex md:col-span-2 items-center justify-end dark:text-gray-400">
                            {isFolderItem ? (
                                <>
                                    <div className="w-8 flex items-center justify-center" />
                                    <div className="w-8 flex items-center justify-center">
                                        <button
                                            title="Download Folder ZIP"
                                            className="cursor-pointer rounded p-1.5 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                e.preventDefault()
                                                triggerDownload(getFolderZipUrl(file.path || file.name), `${file.name}.zip`)
                                                toast.success(`Starting ZIP download for ${file.name}...`)
                                            }}
                                        >
                                            <FontAwesomeIcon icon={['far', 'circle-down']} className="h-4 w-4" />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-8 flex items-center justify-center">
                                        <span
                                            title="Preview file"
                                            className="cursor-pointer rounded p-1.5 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                            onClick={() => onFileClick(file)}
                                        >
                                            <FontAwesomeIcon icon="eye" className="h-4 w-4" />
                                        </span>
                                    </div>
                                    <div className="w-8 flex items-center justify-center">
                                        <a
                                            href={getFileDownloadUrl(file)}
                                            download={file.name}
                                            title="Download file"
                                            className="cursor-pointer rounded p-1.5 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                e.preventDefault()
                                                triggerDownload(getFileDownloadUrl(file), file.name)
                                            }}
                                        >
                                            <FontAwesomeIcon icon={['far', 'circle-down']} className="h-4 w-4" />
                                        </a>
                                    </div>
                                </>
                            )}
                            <div className="w-8 flex items-center justify-center">
                                <Checkbox
                                    checked={selected[file.id] ? 2 : 0}
                                    onChange={() => toggleFileSelected(file.id)}
                                    title="Select item"
                                />
                            </div>
                        </div>
                    </div>
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

export default FileListView
