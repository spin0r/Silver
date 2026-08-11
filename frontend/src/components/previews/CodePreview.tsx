import { useState, useEffect } from 'react'
import { Highlight, themes } from 'prism-react-renderer'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { getLanguageByFileName } from '../../utils/getPreviewType'

interface CodePreviewProps {
    fileUrl: string
    fileName: string
}

const CodePreview = ({ fileUrl, fileName }: CodePreviewProps) => {
    const [content, setContent] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchContent = async () => {
            setLoading(true)
            setError(null)
            try {
                const res = await fetch(fileUrl)
                if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`)
                const text = await res.text()
                setContent(text)
            } catch (err: any) {
                console.error('Failed to load code file:', err)
                setError(err.message || 'Failed to load file content')
            } finally {
                setLoading(false)
            }
        }
        fetchContent()
    }, [fileUrl])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <FontAwesomeIcon icon="spinner" className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-3 text-sm text-gray-400">Loading file content...</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center py-20 text-red-400">
                <span className="text-sm">{error}</span>
            </div>
        )
    }

    const language = getLanguageByFileName(fileName)

    return (
        <div className="overflow-auto rounded-lg text-sm">
            <Highlight theme={themes.vsDark} code={content || ''} language={language}>
                {({ style, tokens, getLineProps, getTokenProps }) => (
                    <pre
                        style={{
                            ...style,
                            margin: 0,
                            padding: '1rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.85rem',
                            lineHeight: '1.6',
                        }}
                    >
                        {tokens.map((line, i) => (
                            <div key={i} {...getLineProps({ line })}>
                                <span
                                    style={{
                                        display: 'inline-block',
                                        width: '3em',
                                        paddingRight: '1em',
                                        textAlign: 'right',
                                        color: '#636363',
                                        userSelect: 'none',
                                    }}
                                >
                                    {i + 1}
                                </span>
                                {line.map((token, key) => (
                                    <span key={key} {...getTokenProps({ token })} />
                                ))}
                            </div>
                        ))}
                    </pre>
                )}
            </Highlight>
        </div>
    )
}

export default CodePreview
