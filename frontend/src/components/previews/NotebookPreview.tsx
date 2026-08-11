import { useState, useEffect } from 'react'
import { Highlight, themes } from 'prism-react-renderer'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

// Types for .ipynb structure
interface NotebookCell {
    cell_type: 'code' | 'markdown' | 'raw'
    source: string | string[]
    outputs?: CellOutput[]
    execution_count?: number | null
    metadata?: Record<string, any>
}

interface CellOutput {
    output_type: 'stream' | 'execute_result' | 'display_data' | 'error'
    text?: string | string[]
    data?: Record<string, string | string[]>
    ename?: string
    evalue?: string
    traceback?: string[]
    name?: string
}

interface Notebook {
    cells: NotebookCell[]
    metadata?: {
        kernelspec?: { display_name?: string; language?: string }
        language_info?: { name?: string }
    }
    nbformat?: number
}

function joinSource(source: string | string[]): string {
    return Array.isArray(source) ? source.join('') : source
}

function getLanguage(notebook: Notebook): string {
    return (
        notebook.metadata?.language_info?.name ||
        notebook.metadata?.kernelspec?.language ||
        'python'
    )
}

// Render a single cell output
function CellOutputBlock({ output }: { output: CellOutput }) {
    if (output.output_type === 'stream') {
        const text = joinSource(output.text || '')
        return (
            <pre className="whitespace-pre-wrap break-words bg-[#1a1a2e] px-4 py-2 text-xs text-gray-300 font-mono border-t border-gray-700/50">
                {text}
            </pre>
        )
    }

    if (output.output_type === 'error') {
        const traceback = (output.traceback || [])
            .join('\n')
            .replace(/\x1b\[[0-9;]*m/g, '')
        return (
            <pre className="whitespace-pre-wrap break-words bg-red-950/30 px-4 py-2 text-xs text-red-300 font-mono border-t border-red-800/30">
                <span className="font-bold text-red-400">{output.ename}: </span>
                {output.evalue}
                {traceback && <div className="mt-1 text-red-400/70">{traceback}</div>}
            </pre>
        )
    }

    if (output.output_type === 'execute_result' || output.output_type === 'display_data') {
        const data = output.data || {}

        if (data['image/png']) {
            const imgData = joinSource(data['image/png'])
            return (
                <div className="border-t border-gray-700/50 p-3">
                    <img src={`data:image/png;base64,${imgData}`} alt="output" className="max-w-full" />
                </div>
            )
        }
        if (data['image/jpeg']) {
            const imgData = joinSource(data['image/jpeg'])
            return (
                <div className="border-t border-gray-700/50 p-3">
                    <img src={`data:image/jpeg;base64,${imgData}`} alt="output" className="max-w-full" />
                </div>
            )
        }

        if (data['text/html']) {
            const html = joinSource(data['text/html'])
            return (
                <div
                    className="border-t border-gray-700/50 p-3 text-sm text-gray-200 overflow-auto notebook-html-output"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            )
        }

        if (data['text/plain']) {
            const text = joinSource(data['text/plain'])
            return (
                <pre className="whitespace-pre-wrap break-words bg-[#1a1a2e] px-4 py-2 text-xs text-gray-300 font-mono border-t border-gray-700/50">
                    {text}
                </pre>
            )
        }
    }

    return null
}

// Single notebook cell
function NotebookCellView({ cell, language }: { cell: NotebookCell; language: string }) {
    const source = joinSource(cell.source)

    if (cell.cell_type === 'markdown') {
        return (
            <div className="border border-gray-700/40 rounded-lg overflow-hidden mb-3">
                <div className="px-4 py-3 prose prose-invert prose-sm max-w-none
                    prose-headings:text-gray-100 prose-p:text-gray-300 prose-a:text-blue-400
                    prose-strong:text-gray-200 prose-code:text-pink-300
                    prose-pre:bg-[#1e1e1e] prose-pre:text-gray-300
                    prose-li:text-gray-300 prose-blockquote:text-gray-400
                    prose-table:text-gray-300 prose-th:text-gray-200
                    prose-td:border-gray-700 prose-th:border-gray-700">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
                </div>
            </div>
        )
    }

    if (cell.cell_type === 'code') {
        return (
            <div className="border border-gray-700/40 rounded-lg overflow-hidden mb-3">
                {/* Cell header */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1e1e2e] border-b border-gray-700/40">
                    <span className="text-[10px] font-mono text-gray-500">
                        [{cell.execution_count ?? ' '}]
                    </span>
                    <span className="text-[10px] text-gray-600 uppercase">{language}</span>
                </div>
                {/* Code content */}
                {source.trim() && (
                    <Highlight theme={themes.vsDark} code={source} language={language}>
                        {({ style, tokens, getLineProps, getTokenProps }) => (
                            <pre
                                style={{
                                    ...style,
                                    margin: 0,
                                    padding: '0.75rem',
                                    borderRadius: 0,
                                    fontSize: '0.8rem',
                                    lineHeight: '1.5',
                                }}
                            >
                                {tokens.map((line, i) => (
                                    <div key={i} {...getLineProps({ line })}>
                                        <span
                                            style={{
                                                display: 'inline-block',
                                                width: '2.5em',
                                                paddingRight: '0.8em',
                                                textAlign: 'right',
                                                color: '#4a4a5a',
                                                fontSize: '0.7rem',
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
                )}
                {/* Outputs */}
                {cell.outputs && cell.outputs.length > 0 && (
                    <div>
                        {cell.outputs.map((output, i) => (
                            <CellOutputBlock key={i} output={output} />
                        ))}
                    </div>
                )}
            </div>
        )
    }

    // Raw cells
    if (cell.cell_type === 'raw') {
        return (
            <div className="border border-gray-700/40 rounded-lg overflow-hidden mb-3">
                <pre className="whitespace-pre-wrap break-words bg-[#1e1e1e] px-4 py-3 text-xs text-gray-400 font-mono">
                    {source}
                </pre>
            </div>
        )
    }

    return null
}

interface NotebookPreviewProps {
    fileUrl: string
    fileName: string
}

const NotebookPreview = ({ fileUrl }: NotebookPreviewProps) => {
    const [notebook, setNotebook] = useState<Notebook | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchNotebook = async () => {
            setLoading(true)
            setError(null)
            try {
                const res = await fetch(fileUrl)
                if (!res.ok) throw new Error(`Failed to fetch notebook: ${res.status}`)
                const data = await res.json()
                setNotebook(data)
            } catch (err: any) {
                console.error('Failed to load notebook:', err)
                setError(err.message || 'Failed to load notebook')
            } finally {
                setLoading(false)
            }
        }
        fetchNotebook()
    }, [fileUrl])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <FontAwesomeIcon icon="spinner" className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-3 text-sm text-gray-400">Loading notebook...</span>
            </div>
        )
    }

    if (error || !notebook) {
        return (
            <div className="flex items-center justify-center py-20 text-red-400">
                <span className="text-sm">{error || 'Failed to parse notebook'}</span>
            </div>
        )
    }

    const language = getLanguage(notebook)
    const kernelName = notebook.metadata?.kernelspec?.display_name || language

    return (
        <div className="rounded-lg overflow-hidden">
            {/* Notebook header */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#16161e] border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-orange-400/80">📓 Jupyter Notebook</span>
                    <span className="text-xs text-gray-500">{notebook.cells.length} cells</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-gray-700/50 text-gray-400">
                        {kernelName}
                    </span>
                    {notebook.nbformat && (
                        <span className="text-[10px] text-gray-600">v{notebook.nbformat}</span>
                    )}
                </div>
            </div>

            {/* Cells */}
            <div className="p-3 bg-[#141418] space-y-0">
                {notebook.cells.map((cell, i) => (
                    <NotebookCellView key={i} cell={cell} language={language} />
                ))}
            </div>
        </div>
    )
}

export default NotebookPreview
