import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { LayoutType } from '../types'

interface SwitchLayoutProps {
    layout: LayoutType
    setLayout: (layout: LayoutType) => void
}

const SwitchLayout = ({ layout, setLayout }: SwitchLayoutProps) => {
    return (
        <div className="flex items-center rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            <button
                onClick={() => setLayout('list')}
                className={`rounded-md px-3 py-1.5 transition-all ${layout === 'list'
                        ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                title="List view"
            >
                <FontAwesomeIcon icon="list" className="h-4 w-4" />
            </button>
            <button
                onClick={() => setLayout('grid')}
                className={`rounded-md px-3 py-1.5 transition-all ${layout === 'grid'
                        ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                title="Grid view"
            >
                <FontAwesomeIcon icon="th-large" className="h-4 w-4" />
            </button>
        </div>
    )
}

export default SwitchLayout
