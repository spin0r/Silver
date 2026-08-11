import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

interface LoadingProps {
    text?: string
}

const Loading = ({ text = 'Loading...' }: LoadingProps) => {
    return (
        <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
                <div className="h-12 w-12 rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
                <div className="absolute left-0 top-0 h-12 w-12 animate-spin rounded-full border-4 border-transparent border-t-gray-500"></div>
            </div>
            <p className="mt-4 text-gray-500 dark:text-gray-400">{text}</p>
        </div>
    )
}

export default Loading
