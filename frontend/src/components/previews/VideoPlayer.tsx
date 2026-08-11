import { useEffect, useRef, useState, FC } from 'react'

interface VideoPlayerProps {
    videoUrl: string
    videoName: string
}

declare global {
    interface Window {
        DPlayer: any
    }
}

const VideoPlayer: FC<VideoPlayerProps> = ({ videoUrl, videoName }) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const playerRef = useRef<any>(null)
    const retryCountRef = useRef<number>(0)
    const MAX_RETRIES = 3

    const [resourcesLoaded, setResourcesLoaded] = useState<boolean>(false)
    const [videoError, setVideoError] = useState<string | null>(null)

    // Helper to load script and css
    const loadPlayerResources = async () => {
        const playerJs = window.UI?.player_js
        const playerCss = window.UI?.player_css

        if (!playerJs || !playerCss) {
            console.error('DPlayer configuration missing in window.UI')
            return
        }

        // Load CSS
        if (!document.querySelector(`link[href="${playerCss}"]`)) {
            const link = document.createElement('link')
            link.rel = 'stylesheet'
            link.href = playerCss
            document.head.appendChild(link)
        }

        // Load JS
        if (!window.DPlayer) {
            return new Promise<void>((resolve, reject) => {
                const script = document.createElement('script')
                script.src = playerJs
                script.onload = () => resolve()
                script.onerror = () => {
                    console.error('VideoPlayer: Failed to load JS')
                    reject(new Error('Failed to load DPlayer'))
                }
                document.body.appendChild(script)
            })
        }
    }

    // Load resources on mount
    useEffect(() => {
        loadPlayerResources().then(() => setResourcesLoaded(true)).catch(console.error)
    }, [])

    // Initialize Player
    useEffect(() => {
        let mounted = true

        const initPlayer = async () => {
            if (!containerRef.current) return
            if (!resourcesLoaded) return

            try {
                if (!mounted) return

                // If player already exists, destroy it
                if (playerRef.current) {
                    playerRef.current.destroy()
                }

                // Reset error state and retry count on new init
                setVideoError(null)
                retryCountRef.current = 0

                // Create VideoPlayer instance
                const dp = new window.DPlayer({
                    container: containerRef.current,
                    video: {
                        url: videoUrl,
                        type: 'auto',
                    },
                    autoplay: false,
                    theme: '#8b5cf6',
                    loop: false,
                    lang: 'en',
                    screenshot: true,
                    hotkey: true,
                    preload: 'metadata',
                    volume: 0.7,
                    playbackSpeed: [0.5, 0.75, 1, 1.25, 1.5, 2],
                    contextmenu: [
                        {
                            text: videoName,
                            link: videoUrl,
                        },
                    ],
                })

                playerRef.current = dp

                // Auto-retry on transient errors (connection resets, 500s, etc.)
                dp.on('error', () => {
                    if (!mounted) return
                    if (retryCountRef.current < MAX_RETRIES) {
                        retryCountRef.current++
                        console.warn(`VideoPlayer: error #${retryCountRef.current}, retrying in 2s...`)
                        setTimeout(() => {
                            if (!mounted || !playerRef.current) return
                            // Append cache-busting param to force a fresh request
                            const bustUrl = videoUrl + (videoUrl.includes('?') ? '&' : '?') + '_t=' + Date.now()
                            playerRef.current.switchVideo({ url: bustUrl })
                            playerRef.current.play()
                        }, 2000)
                    } else {
                        setVideoError('Video failed to load. The server returned an error — try refreshing or downloading the file instead.')
                    }
                })
            } catch (err) {
                console.error('Failed to initialize player:', err)
            }
        }

        initPlayer()

        // Cleanup on unmount
        return () => {
            mounted = false
            if (playerRef.current) {
                playerRef.current.destroy()
                playerRef.current = null
            }
        }
    }, [videoUrl, videoName, resourcesLoaded])

    return (
        <div className="mx-auto aspect-video w-full max-h-[80vh] overflow-hidden rounded-lg bg-black relative group shadow-lg ring-1 ring-white/10">
            {(!resourcesLoaded) && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
                    <div className="relative h-12 w-12">
                        <div className="absolute inset-0 rounded-full border-4 border-white/20"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-t-white border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                    </div>
                </div>
            )}
            {videoError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 px-6 text-center">
                    <svg className="h-10 w-10 text-red-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <p className="text-white/80 text-sm max-w-sm">{videoError}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-3 px-4 py-1.5 rounded-lg bg-white/10 text-white/70 text-xs hover:bg-white/20 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            )}
            <div ref={containerRef} className="h-full w-full" />
        </div>
    )
}

export default VideoPlayer
