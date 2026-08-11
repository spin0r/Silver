import { Fragment, useRef, useState } from 'react'
import { Menu, Transition } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import toast from 'react-hot-toast'

interface DownloadButtonGroupProps {
    downloadUrl?: string
    fileName?: string
    onGenerateLinkClick?: () => Promise<void>
    onRenameClick?: () => void
    color?: 'gray' | 'white'
    isFolder?: boolean
    layout?: 'menu' | 'buttons'
    onDeleteClick?: () => void
}

export default function DownloadButtonGroup({
    downloadUrl = '',
    fileName: _fileName = '',
    onGenerateLinkClick,

    onRenameClick,
    color = 'gray',
    isFolder = false,
    layout = 'menu',
    onDeleteClick
}: DownloadButtonGroupProps) {
    const [menuPosition, setMenuPosition] = useState<'up' | 'down'>('down')
    const buttonRef = useRef<HTMLButtonElement>(null)
    const [generatingLink, setGeneratingLink] = useState(false)

    const handleTriggerClick = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect()
            const spaceBelow = window.innerHeight - rect.bottom
            if (spaceBelow < 250) {
                setMenuPosition('up')
            } else {
                setMenuPosition('down')
            }
        }
    }

    const copyToClipboard = (text: string) => {
        const successMsg = isFolder ? 'Copied folder link to clipboard!' : 'Copied direct link to clipboard!'
        navigator.clipboard.writeText(text).then(() => {
            toast.success(successMsg)
        }).catch(() => {
            toast.error('Failed to copy link')
        })
    }

    const getFullUrl = () => {
        const url = `${window.location.origin}${downloadUrl}`
        return isFolder && !url.endsWith('/') ? `${url}/` : url
    }

    const buttonClass = color === 'white'
        ? "inline-flex w-full justify-center rounded-full p-2 text-sm font-medium text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75"
        : "inline-flex w-full justify-center rounded-full p-2 text-sm font-medium text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 dark:text-gray-400 dark:hover:bg-gray-800"

    if (layout === 'buttons') {
        const baseBtnClass = "flex items-center space-x-2 rounded-lg border bg-white py-2 px-4 text-sm font-medium text-gray-900 whitespace-nowrap hover:bg-gray-100/10 focus:z-10 focus:ring-2 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-900"

        const colorMap: Record<string, string> = {
            blue: 'hover:text-blue-600 focus:ring-blue-200 focus:text-blue-600 border-blue-300 dark:border-blue-700 dark:focus:ring-blue-500',
            pink: 'hover:text-pink-600 focus:ring-pink-200 focus:text-pink-600 border-pink-300 dark:border-pink-700 dark:focus:ring-pink-500',
            teal: 'hover:text-teal-600 focus:ring-teal-200 focus:text-teal-600 border-teal-300 dark:border-teal-700 dark:focus:ring-teal-500',
            yellow: 'hover:text-yellow-400 focus:ring-yellow-100 focus:text-yellow-400 border-yellow-300 dark:border-yellow-400 dark:focus:ring-yellow-300',
            red: 'hover:text-red-600 focus:ring-red-200 focus:text-red-600 border-red-300 dark:border-red-700 dark:focus:ring-red-500',
        }

        return (
            <div className="flex flex-nowrap justify-center gap-2 overflow-x-auto">
                {!isFolder && (
                    <button
                        onClick={() => window.open(downloadUrl, '_blank')}
                        className={`${baseBtnClass} ${colorMap.blue}`}
                    >
                        <FontAwesomeIcon icon="file-download" />
                        <span>Download</span>
                    </button>
                )}
                <button
                    onClick={() => copyToClipboard(getFullUrl())}
                    className={`${baseBtnClass} ${colorMap.pink}`}
                >
                    <FontAwesomeIcon icon="copy" />
                    <span>{isFolder ? 'Copy Folder Link' : 'Copy Direct Link'}</span>
                </button>
                {onGenerateLinkClick && (
                    <button
                        onClick={async () => {
                            setGeneratingLink(true)
                            try { await onGenerateLinkClick() } finally { setGeneratingLink(false) }
                        }}
                        disabled={generatingLink}
                        className={`${baseBtnClass} ${colorMap.teal}`}
                    >
                        <FontAwesomeIcon icon={generatingLink ? 'spinner' : 'link'} spin={generatingLink} />
                        <span>{generatingLink ? 'Generating...' : 'Protected Link'}</span>
                    </button>
                )}
                {onRenameClick && (
                    <button
                        onClick={onRenameClick}
                        className={`${baseBtnClass} ${colorMap.yellow}`}
                    >
                        <FontAwesomeIcon icon="edit" />
                        <span>Rename</span>
                    </button>
                )}
                {onDeleteClick && (
                    <button
                        onClick={onDeleteClick}
                        className={`${baseBtnClass} ${colorMap.red}`}
                    >
                        <FontAwesomeIcon icon="trash" />
                        <span>Delete</span>
                    </button>
                )}
            </div>
        )
    }

    return (
        <Menu as="div" className="relative inline-block text-left">
            {({ close }) => (
                <>
                    <div>
                        <Menu.Button ref={buttonRef} onClick={handleTriggerClick} className={buttonClass}>
                            <FontAwesomeIcon icon="ellipsis-vertical" className="h-5 w-5 drop-shadow-sm" />
                        </Menu.Button>
                    </div>
                    <Transition
                        as={Fragment}
                        enter="transition ease-out duration-100"
                        enterFrom="transform opacity-0 scale-95"
                        enterTo="transform opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="transform opacity-100 scale-100"
                        leaveTo="transform opacity-0 scale-95"
                    >
                        <Menu.Items className={`absolute right-0 w-48 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none dark:bg-[#18181B] dark:divide-gray-700 dark:ring-gray-700 z-50 ${menuPosition === 'up' ? 'bottom-full mb-2 origin-bottom-right' : 'mt-2 origin-top-right'}`}>
                            <div className="px-1 py-1">
                                {!isFolder && (
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    window.open(downloadUrl, '_blank')
                                                    close()
                                                }}
                                                className={`${active ? 'bg-gray-100 dark:bg-gray-700' : ''
                                                    } text-gray-900 dark:text-gray-100 group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                                            >
                                                <FontAwesomeIcon icon="file-download" className="mr-2 h-4 w-4" />
                                                Download
                                            </button>
                                        )}
                                    </Menu.Item>
                                )}
                                <Menu.Item>
                                    {({ active }) => (
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                copyToClipboard(getFullUrl())
                                                close()
                                            }}
                                            className={`${active ? 'bg-gray-100 dark:bg-gray-700' : ''
                                                } text-gray-900 dark:text-gray-100 group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                                        >
                                            <FontAwesomeIcon icon="copy" className="mr-2 h-4 w-4" />
                                            {isFolder ? 'Copy Folder Link' : 'Copy Direct Link'}
                                        </button>
                                    )}
                                </Menu.Item>
                            </div>
                            {(onGenerateLinkClick || onRenameClick) && (
                                <div className="px-1 py-1">
                                    {onGenerateLinkClick && (
                                        <Menu.Item>
                                            {({ active }) => (
                                                <button
                                                    onClick={async (e) => {
                                                        e.preventDefault()
                                                        e.stopPropagation()
                                                        if (onGenerateLinkClick) {
                                                            setGeneratingLink(true)
                                                            try { await onGenerateLinkClick() } finally { setGeneratingLink(false) }
                                                        }
                                                        close()
                                                    }}
                                                    disabled={generatingLink}
                                                    className={`${active ? 'bg-gray-100 dark:bg-gray-700' : ''
                                                        } text-gray-900 dark:text-gray-100 group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                                                >
                                                    <FontAwesomeIcon icon={generatingLink ? 'spinner' : 'link'} spin={generatingLink} className="mr-2 h-4 w-4" />
                                                    {generatingLink ? 'Generating...' : 'Protected Link'}
                                                </button>
                                            )}
                                        </Menu.Item>
                                    )}
                                    {onRenameClick && (
                                        <Menu.Item>
                                            {({ active }) => (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault()
                                                        e.stopPropagation()
                                                        if (onRenameClick) onRenameClick()
                                                        close()
                                                    }}
                                                    className={`${active ? 'bg-gray-100 dark:bg-gray-700' : ''
                                                        } text-gray-900 dark:text-gray-100 group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                                                >
                                                    <FontAwesomeIcon icon="edit" className="mr-2 h-4 w-4" />
                                                    Rename
                                                </button>
                                            )}
                                        </Menu.Item>
                                    )}
                                </div>
                            )}
                            {onDeleteClick && (
                                <div className="px-1 py-1">
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    if (onDeleteClick) onDeleteClick()
                                                    close()
                                                }}
                                                className={`${active ? 'bg-red-50 dark:bg-red-900/20' : ''
                                                    } text-red-600 dark:text-red-400 group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                                            >
                                                <FontAwesomeIcon icon="trash" className="mr-2 h-4 w-4" />
                                                Delete
                                            </button>
                                        )}
                                    </Menu.Item>
                                </div>
                            )}
                        </Menu.Items>
                    </Transition>
                </>
            )}
        </Menu>
    )
}
