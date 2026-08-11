import { useState, Fragment, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { Dialog, Transition } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { getFileIcon, extractEmojiFromFileName } from '../utils/fileIcons'
import { searchFiles, isFolder } from '../utils/api'
import type { DriveFile } from '../types'

interface SearchModalProps {
    isOpen: boolean
    onClose: () => void
}

const SearchModal = ({ isOpen, onClose }: SearchModalProps) => {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<DriveFile[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const navigate = useNavigate()
    const location = useLocation()

    // Get current drive from URL
    const currentDrive = 0
    const driveNames: string[] = ['Repository']
    const currentDriveName = driveNames[currentDrive] || 'Drive'
    const hasMultipleDrives = driveNames.length > 1

    // Reset selected index when results change
    useEffect(() => {
        setSelectedIndex(results.length > 0 ? 0 : -1)
    }, [results])

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setQuery('')
            setResults([])
            setSelectedIndex(-1)
        }
    }, [isOpen])

    // Debounced search
    useEffect(() => {
        if (!query.trim()) {
            setResults([])
            return
        }

        const timer = setTimeout(async () => {
            setLoading(true)
            setError(null)

            try {
                const data = await searchFiles(query)
                setResults(data.data?.files || [])
            } catch (err) {
                setError('Failed to search. Please try again.')
                setResults([])
            } finally {
                setLoading(false)
            }
        }, 500) // 500ms debounce

        return () => clearTimeout(timer)
    }, [query])

    const handleResultClick = (file: DriveFile) => {
        onClose()
        setQuery('')
        // Navigate to file location
        // For now we just close the modal - proper path building would require parent path from API
        navigate(`/${file.path}${file.mimeType.includes('folder') ? '/' : ''}`.replace(/\/+/g, '/'))

    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (results.length === 0) return

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setSelectedIndex(prev => (prev + 1) % results.length)
                break
            case 'ArrowUp':
                e.preventDefault()
                setSelectedIndex(prev => (prev - 1 + results.length) % results.length)
                break
            case 'Enter':
                e.preventDefault()
                if (selectedIndex >= 0 && selectedIndex < results.length) {
                    const file = results[selectedIndex]
                    onClose()
                    setQuery('')
                    if (file.link) {
                        navigate(file.link)
                    }
                }
                break
        }
    }

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[100]" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-200"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-150"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-start justify-center p-4 pt-[15vh]">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-200"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-150"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5 transition-all dark:bg-[#18181B] dark:ring-white/10">
                                {/* Search input */}
                                <div className="flex items-center border-b border-gray-200 px-4 dark:border-gray-700">
                                    <FontAwesomeIcon
                                        icon="search"
                                        className="h-5 w-5 text-gray-400"
                                    />
                                    <input
                                        type="text"
                                        className="flex-1 bg-transparent px-4 py-4 text-gray-900 placeholder-gray-400 outline-none dark:text-white"
                                        placeholder={hasMultipleDrives ? `Search in ${currentDriveName}...` : 'Search files and folders...'}
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        autoFocus
                                    />
                                    <kbd className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                        ESC
                                    </kbd>
                                </div>

                                {/* Results */}
                                <div className="max-h-[60vh] overflow-y-auto">
                                    {loading && (
                                        <div className="flex items-center justify-center py-12">
                                            <FontAwesomeIcon
                                                icon="spinner"
                                                className="h-6 w-6 animate-spin text-gray-500"
                                            />
                                            <span className="ml-3 text-gray-500">Searching...</span>
                                        </div>
                                    )}

                                    {error && (
                                        <div className="py-12 text-center text-red-500">
                                            {error}
                                        </div>
                                    )}

                                    {!loading && !error && query && results.length === 0 && (
                                        <div className="py-12 text-center text-gray-500">
                                            No results found for "{query}"
                                        </div>
                                    )}

                                    {!loading && results.length > 0 && (
                                        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {results.map((file, index) => {
                                                const isFolderItem = isFolder(file.mimeType)
                                                const { emoji, cleanName } = isFolderItem
                                                    ? extractEmojiFromFileName(file.name)
                                                    : { emoji: null, cleanName: file.name }
                                                const isSelected = index === selectedIndex

                                                return (
                                                    <li key={file.id}>
                                                        <Link
                                                            to={file.link || '#'}
                                                            onClick={() => {
                                                                onClose()
                                                                setQuery('')
                                                            }}
                                                            className={`flex w-full items-center space-x-3 px-4 py-3 text-left transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                                        >
                                                            <div className="flex-shrink-0 w-5 text-center">
                                                                {emoji ? (
                                                                    <span className="flex h-5 w-5 items-center justify-center text-base leading-none select-none">
                                                                        {emoji}
                                                                    </span>
                                                                ) : (
                                                                    <FontAwesomeIcon
                                                                        icon={isFolderItem ? ['far', 'folder'] : getFileIcon(file.mimeType, file.fileExtension)}
                                                                        className={`h-4 w-4 ${isFolderItem ? 'text-gray-500' : 'text-gray-400'}`}
                                                                    />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 truncate">
                                                                <div className="truncate font-medium text-gray-900 dark:text-white">
                                                                    {cleanName}
                                                                </div>
                                                            </div>
                                                        </Link>
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    )}

                                    {!query && (
                                        <div className="py-12 text-center text-gray-400">
                                            Start typing to search...
                                        </div>
                                    )}
                                </div>

                                {/* Keyboard hints footer */}
                                <div className="flex items-center justify-center gap-4 border-t border-gray-200 px-4 py-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                    <span className="flex items-center gap-1">
                                        <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-medium dark:bg-gray-800">↑↓</kbd>
                                        <span>to navigate</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-medium dark:bg-gray-800">Enter</kbd>
                                        <span>to select</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-medium dark:bg-gray-800">ESC</kbd>
                                        <span>to close</span>
                                    </span>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}

export default SearchModal
