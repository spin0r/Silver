import { Link, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'


const Breadcrumb = () => {
    const location = useLocation()
    
    const pathParts = location.pathname.split('/').filter(Boolean)

    // Remove drive prefix (e.g., "0:") if present
    const cleanParts = pathParts.map(part => {
        if (part.match(/^\d+:$/)) return null
        return decodeURIComponent(part)
    }).filter(Boolean) as string[]

    // Build path links
    const buildPath = (index: number): string => {
        const folderParts = cleanParts.slice(0, index + 1)
        if (folderParts.length === 0) {
            return '/'
        }
        return `/${folderParts.join('/')}/`
    }


    return (
        <nav className="flex items-center space-x-1 overflow-x-auto no-scrollbar py-2 text-sm">
            {/* Home */}
            <Link
                to={"/"}
                className="flex items-center space-x-1 rounded px-2 py-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            >
                <FontAwesomeIcon icon="home" className="h-4 w-4" />
                <span className="hidden sm:inline">Home</span>
            </Link>

            {cleanParts.map((part, index) => (
                <div key={index} className="flex items-center">
                    <FontAwesomeIcon
                        icon="chevron-right"
                        className="mx-1 h-3 w-3 text-gray-400"
                    />
                    {index === cleanParts.length - 1 ? (
                        // Current folder (not a link)
                        <span className="rounded px-2 py-1 font-medium text-gray-900 dark:text-white">
                            {part}
                        </span>
                    ) : (
                        <Link
                            to={buildPath(index)}
                            className="rounded px-2 py-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                        >
                            {part}
                        </Link>
                    )}
                </div>
            ))}
        </nav>
    )
}

export default Breadcrumb
