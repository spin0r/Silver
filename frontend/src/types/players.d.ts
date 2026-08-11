declare module 'dplayer-enhanced' {
    interface VideoPlayerOptions {
        container: HTMLElement
        live?: boolean
        autoplay?: boolean
        theme?: string
        loop?: boolean
        lang?: string
        screenshot?: boolean
        hotkey?: boolean
        preload?: 'none' | 'metadata' | 'auto'
        volume?: number
        playbackSpeed?: number[]
        logo?: string
        apiBackend?: unknown
        video: {
            url: string
            pic?: string
            type?: string
            customType?: Record<string, unknown>
            quality?: Array<{ name: string; url: string; type?: string }>
            defaultQuality?: number
        }
        subtitle?: {
            url: string
            type?: string
            fontSize?: string
            bottom?: string
            color?: string
        }
        danmaku?: unknown
        contextmenu?: Array<{ text: string; link?: string; click?: () => void }>
        highlight?: Array<{ time: number; text: string }>
        mutex?: boolean
    }

    class VideoPlayer {
        constructor(options: VideoPlayerOptions)
        play(): void
        pause(): void
        seek(time: number): void
        toggle(): void
        on(event: string, handler: (...args: unknown[]) => void): void
        switchVideo(video: { url: string; pic?: string; type?: string }): void
        notice(text: string, time?: number, opacity?: number): void
        switchQuality(index: number): void
        destroy(): void
        speed(rate: number): void
        volume(percentage?: number, nostorage?: boolean, nonotice?: boolean): number
        video: HTMLVideoElement
        paused: boolean
    }

    export default VideoPlayer
}

declare module 'react-audio-player' {
    import { Component, RefObject } from 'react'

    interface ReactAudioPlayerProps {
        autoPlay?: boolean
        children?: React.ReactNode
        className?: string
        controls?: boolean
        controlsList?: string
        crossOrigin?: string
        id?: string
        listenInterval?: number
        loop?: boolean
        muted?: boolean
        onAbort?: (e: Event) => void
        onCanPlay?: (e: Event) => void
        onCanPlayThrough?: (e: Event) => void
        onEnded?: (e: Event) => void
        onError?: (e: Event) => void
        onListen?: (time: number) => void
        onLoadedMetadata?: (e: Event) => void
        onPause?: (e: Event) => void
        onPlay?: (e: Event) => void
        onSeeked?: (e: Event) => void
        onVolumeChanged?: (e: Event) => void
        preload?: '' | 'none' | 'metadata' | 'auto'
        src?: string
        style?: React.CSSProperties
        title?: string
        volume?: number
    }

    class ReactAudioPlayer extends Component<ReactAudioPlayerProps> {
        audioEl: RefObject<HTMLAudioElement>
    }

    export default ReactAudioPlayer
}
