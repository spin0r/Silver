import { useState, Fragment, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

interface RenameModalProps {
    isOpen: boolean
    onClose: () => void
    onRename: (newName: string) => Promise<void>
    currentName: string
}

const RenameModal = ({ isOpen, onClose, onRename, currentName }: RenameModalProps) => {
    const [newName, setNewName] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setNewName(currentName)
        }
    }, [isOpen, currentName])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newName.trim() || newName === currentName) {
            onClose()
            return
        }

        setLoading(true)
        try {
            await onRename(newName)
            onClose()
        } catch (error) {
            // Error handling is done in parent
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[100]" onClose={() => !loading && onClose()}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel
                                className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all dark:bg-[#18181B] dark:border dark:border-gray-700/50"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Dialog.Title
                                    as="h3"
                                    className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 flex items-center gap-2"
                                >
                                    <FontAwesomeIcon icon="pen-to-square" className="text-gray-700 dark:text-gray-300" />
                                    Rename File
                                </Dialog.Title>
                                <form onSubmit={handleSubmit} className="mt-4">
                                    <div>
                                        <label htmlFor="filename" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Name
                                        </label>
                                        <input
                                            type="text"
                                            id="filename"
                                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white sm:text-sm px-3 py-2"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            autoFocus
                                            disabled={loading}
                                        />
                                    </div>

                                    <div className="mt-6 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                                            onClick={onClose}
                                            disabled={loading}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="inline-flex justify-center rounded-md border border-transparent bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                                            disabled={loading || !newName.trim() || newName === currentName}
                                        >
                                            {loading ? (
                                                <>
                                                    <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                                                    Renaming...
                                                </>
                                            ) : (
                                                'Rename'
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}

export default RenameModal
