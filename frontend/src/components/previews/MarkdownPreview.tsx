import { useState, useEffect, FC } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { DriveFile } from '../../types'

interface MarkdownPreviewProps {
    file: DriveFile
    basePath: string
    standalone?: boolean
}

const MarkdownPreview: FC<MarkdownPreviewProps> = ({ file, basePath, standalone = true }) => {
    const [content, setContent] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchContent = async () => {
            setLoading(true)
            setError(null)
            try {
                // Construct the URL to fetch the README content
                const url = file.link || `${basePath}${file.name}`
                const response = await fetch(url)
                if (!response.ok) {
                    throw new Error(`Failed to fetch: ${response.status}`)
                }
                const text = await response.text()
                setContent(text)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load content')
            } finally {
                setLoading(false)
            }
        }

        fetchContent()
    }, [file, basePath])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <FontAwesomeIcon icon="spinner" className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading README...</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className={`rounded-lg border border-yellow-200/50 bg-yellow-50/50 p-3 text-center dark:border-yellow-800/30 dark:bg-yellow-900/10 ${standalone ? '' : 'mt-4'}`}>
                <span className="text-xs text-yellow-600 dark:text-yellow-500">README.md could not be loaded</span>
            </div>
        )
    }

    return (
        <div className={`rounded-lg border border-gray-200/50 bg-white shadow-sm dark:border-gray-700/50 dark:bg-[#18181B] ${standalone ? '' : 'mt-4'}`}>
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-gray-200/50 px-4 py-3 dark:border-gray-700/50">
                <FontAwesomeIcon icon={['fab', 'markdown']} className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{file.name}</span>
            </div>
            {/* Content */}
            <div className="markdown-body p-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content}
                </ReactMarkdown>
            </div>
        </div>
    )
}

export default MarkdownPreview
