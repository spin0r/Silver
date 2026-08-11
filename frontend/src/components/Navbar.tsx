import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import SearchModal from './SearchModal'
import { parsePathInfo } from '../utils/api'

const Navbar = () => {
    const [searchOpen, setSearchOpen] = useState(false)
    const navigate = useNavigate()
    const location = useLocation()

    const [showModified, setShowModified] = useState(() => localStorage.getItem('showModifiedColumn') !== 'false')

    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.theme !== 'light'
        }
        return true
    })

    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }, [isDark])


    const toggleTheme = () => {
        if (document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark')
            localStorage.setItem('theme', 'light')
            setIsDark(false)
        } else {
            document.documentElement.classList.add('dark')
            localStorage.setItem('theme', 'dark')
            setIsDark(true)
        }
    }

    // Drive switcher state
    const driveNames: string[] = ['Repository']
    const currentDrive = 0
    const [driveMenuOpen, setDriveMenuOpen] = useState(false)
    const driveMenuRef = useRef<HTMLDivElement>(null)

    const hasMultipleDrives = false

    // Keyboard shortcut for search (Ctrl/Cmd + K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                e.stopPropagation() // Stop event bubbling
                setSearchOpen(true)
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [])

    // Close drive menu on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (driveMenuRef.current && !driveMenuRef.current.contains(e.target as Node)) {
                setDriveMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const toggleModifiedColumn = () => {
        const newValue = !showModified
        setShowModified(newValue)
        localStorage.setItem('showModifiedColumn', String(newValue))
        // Dispatch custom event for FileListView to listen
        window.dispatchEvent(new CustomEvent('columnVisibilityChange', { detail: { showModified: newValue } }))
    }

    const switchDrive = (driveIndex: number) => {
        setDriveMenuOpen(false)
        navigate(`/${driveIndex}:/`)
    }

    return (
        <>
            <nav className="sticky top-0 z-50 border-b border-gray-200/50 bg-white/80 backdrop-blur-md dark:border-gray-700/50 dark:bg-[#18181B]">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
                    {/* Logo + Title */}
                    <div className="flex items-center space-x-2">
                        <Link
                            to="/"
                            className="flex items-center space-x-2 text-gray-900 transition-opacity hover:opacity-70 dark:text-white"
                        >
                            <svg
                                aria-hidden="true"
                                focusable="false"
                                data-prefix="fas"
                                data-icon="cube"
                                className="h-6 w-6 text-gray-900 dark:text-white"

                                role="img"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 512 512"
                            >
                                <path
                                    fill="currentColor"
                                    d="M234.5 5.7c13.9-5 29.1-5 43.1 0l192 68.6C495 83.4 512 107.5 512 134.6l0 242.9c0 27-17 51.2-42.5 60.3l-192 68.6c-13.9 5-29.1 5-43.1 0l-192-68.6C17 428.6 0 404.5 0 377.4L0 134.6c0-27 17-51.2 42.5-60.3l192-68.6zM256 66L82.3 128 256 190l173.7-62L256 66zm32 368.6l160-57.1 0-188L288 246.6l0 188z"
                                ></path>
                            </svg>
                            <span className="font-semibold text-base">{window.SITE_NAME || 'Notes'}</span>
                        </Link>


                        {/* Drive Switcher Dropdown */}
                        {hasMultipleDrives && (
                            <div className="relative" ref={driveMenuRef}>
                                <button
                                    onClick={() => setDriveMenuOpen(!driveMenuOpen)}
                                    className="ml-2 flex items-center space-x-1.5 rounded-lg border border-gray-200/60 bg-gray-50 px-2.5 py-1 text-sm text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-100 dark:border-gray-600/60 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-700"
                                >
                                    <FontAwesomeIcon icon="hard-drive" className="h-3 w-3 opacity-60" />
                                    <span className="max-w-[120px] truncate">{driveNames[currentDrive] || 'Drive'}</span>
                                    <FontAwesomeIcon
                                        icon="chevron-down"
                                        className={`h-2.5 w-2.5 opacity-50 transition-transform duration-200 ${driveMenuOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>

                                {/* Dropdown Menu */}
                                {driveMenuOpen && (
                                    <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-lg border border-gray-200/60 bg-white shadow-lg dark:border-gray-600/60 dark:bg-[#1f1f23]">
                                        <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                            Switch Drive
                                        </div>
                                        {((driveNames || []) as string[]).map((name, index) => (
                                            <button
                                                key={index}
                                                onClick={() => switchDrive(index)}
                                                className={`flex w-full items-center space-x-2.5 px-3 py-2 text-left text-sm transition-colors ${index === currentDrive
                                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                                                    }`}
                                            >
                                                <FontAwesomeIcon
                                                    icon="hard-drive"
                                                    className={`h-3.5 w-3.5 ${index === currentDrive
                                                        ? 'text-blue-500 dark:text-blue-400'
                                                        : 'text-gray-400 dark:text-gray-500'
                                                        }`}
                                                />
                                                <span className="flex-1 truncate">{name}</span>
                                                {index === currentDrive && (
                                                    <FontAwesomeIcon icon="check" className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right side actions */}
                    <div className="flex items-center space-x-3">
                        {/* Theme Toggle */}
                        <button
                            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                            onClick={toggleTheme}
                        >
                            <FontAwesomeIcon
                                icon={isDark ? 'sun' : 'moon'}
                                className="h-4 w-4"
                            />
                        </button>



                        {/* Search button */}
                        <button
                            onClick={() => setSearchOpen(true)}
                            className="flex items-center space-x-2 rounded-lg bg-gray-100 px-3 py-1.5 text-gray-600 transition-all hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            <FontAwesomeIcon icon="search" className="h-4 w-4" />
                            <span className="hidden text-sm md:inline">Search...</span>
                            <div className="hidden items-center space-x-1 md:flex">
                                <kbd className="rounded bg-gray-200 px-1.5 py-0.5 text-xs font-medium dark:bg-gray-700">
                                    Ctrl
                                </kbd>
                                <kbd className="rounded bg-gray-200 px-1.5 py-0.5 text-xs font-medium dark:bg-gray-700">
                                    K
                                </kbd>
                            </div>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Search Modal */}
            <SearchModal
                isOpen={searchOpen}
                onClose={() => setSearchOpen(false)}
            />
        </>
    )
}

export default Navbar
