import { Dispatch, Fragment, SetStateAction, useRef, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import toast from 'react-hot-toast'

interface LinkContainerProps {
    title: string
    value: string
}

function LinkContainer({ title, value }: LinkContainerProps) {
    const [copied, setCopied] = useState(false)

    const copyToClipboard = () => {
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true)
            toast.success('Copied to clipboard!')
            setTimeout(() => setCopied(false), 1000)
        }).catch(() => {
            toast.error('Failed to copy')
        })
    }

    return (
        <>
            <h4 className="py-2 text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-400">
                {title}
            </h4>
            <div className="group relative mb-2 max-h-24 overflow-y-scroll break-all rounded border border-gray-400/20 bg-gray-50 p-2.5 font-mono text-sm dark:bg-gray-800">
                <div className="opacity-80 pr-10">{value}</div>
                <button
                    onClick={copyToClipboard}
                    className="absolute top-2 right-2 w-8 h-8 rounded border border-gray-400/40 bg-gray-100 flex items-center justify-center opacity-0 transition-all duration-100 hover:bg-gray-200 group-hover:opacity-100 dark:bg-gray-700 dark:hover:bg-gray-600"
                >
                    {copied ? (
                        <FontAwesomeIcon icon="check" className="text-green-500" />
                    ) : (
                        <FontAwesomeIcon icon="copy" className="text-gray-500" />
                    )}
                </button>
            </div>
        </>
    )
}

interface CustomEmbedLinkMenuProps {
    path: string
    fileName: string
    menuOpen: boolean
    setMenuOpen: Dispatch<SetStateAction<boolean>>
}

export default function CustomEmbedLinkMenu({
    path,
    fileName,
    menuOpen,
    setMenuOpen,
}: CustomEmbedLinkMenuProps) {
    const focusInputRef = useRef<HTMLInputElement>(null)
    const [name, setName] = useState(fileName)

    const closeMenu = () => setMenuOpen(false)

    const baseUrl = window.location.origin
    const encodedPath = encodeURIComponent(path)

    return (
        <Transition appear show={menuOpen} as={Fragment}>
            <Dialog
                as="div"
                className="fixed inset-0 z-50 overflow-y-auto"
                onClose={closeMenu}
                initialFocus={focusInputRef}
            >
                <div className="min-h-screen px-4 text-center">
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-100"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-100"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black/60" />
                    </Transition.Child>

                    {/* Center trick */}
                    <span className="inline-block h-screen align-middle" aria-hidden="true">
                        &#8203;
                    </span>

                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-100"
                        enterFrom="opacity-0 scale-95"
                        enterTo="opacity-100 scale-100"
                        leave="ease-in duration-100"
                        leaveFrom="opacity-100 scale-100"
                        leaveTo="opacity-0 scale-95"
                    >
                        <div className="inline-block max-h-[80vh] w-full max-w-2xl transform overflow-hidden overflow-y-scroll rounded-xl border border-gray-400/30 bg-white p-6 text-left align-middle shadow-2xl transition-all dark:bg-[#18181B] dark:text-white">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4">
                                <Dialog.Title as="h3" className="text-xl font-bold">
                                    Customize Direct Link
                                </Dialog.Title>
                                <button
                                    onClick={closeMenu}
                                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                                >
                                    <FontAwesomeIcon icon="times" />
                                </button>
                            </div>

                            <Dialog.Description as="p" className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                Customize the direct link URL to include the file extension or a custom filename.
                            </Dialog.Description>

                            <div className="space-y-4">
                                {/* Filename input */}
                                <div>
                                    <h4 className="py-2 text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-400">
                                        Filename
                                    </h4>
                                    <input
                                        className="w-full rounded-lg border border-gray-300 p-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:ring-blue-700"
                                        ref={focusInputRef}
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                    />
                                </div>

                                {/* URL variants */}
                                <LinkContainer
                                    title="Default"
                                    value={`${baseUrl}${path}`}
                                />
                                <LinkContainer
                                    title="URL Encoded"
                                    value={`${baseUrl}${encodedPath}`}
                                />
                                <LinkContainer
                                    title="With Custom Filename"
                                    value={`${baseUrl}/api/name/${name}?path=${path}`}
                                />
                                <LinkContainer
                                    title="Custom + Encoded"
                                    value={`${baseUrl}/api/name/${encodeURIComponent(name)}?path=${encodedPath}`}
                                />
                            </div>
                        </div>
                    </Transition.Child>
                </div>
            </Dialog>
        </Transition>
    )
}
