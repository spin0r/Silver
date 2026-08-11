import { useRef, useState, useEffect, FC } from 'react'
import ReactAudioPlayer from 'react-audio-player'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { formatDate } from '../../utils/fileIcons'

interface AudioPlayerProps {
    audioUrl: string
    fileName: string
    modifiedTime?: string
    thumbnailUrl?: string
}

const PlayerState = { PAUSED: 0, PLAYING: 1, LOADING: 2 }; type PlayerState = number;

const AudioPlayer: FC<AudioPlayerProps> = ({ audioUrl, fileName, modifiedTime, thumbnailUrl }) => {
    const rapRef = useRef<ReactAudioPlayer>(null)
    const [playerStatus, setPlayerStatus] = useState(PlayerState.LOADING)
    const [playerVolume, setPlayerVolume] = useState(1)
    const [brokenThumbnail, setBrokenThumbnail] = useState(false)

    useEffect(() => {
        // Manually get the HTML audio element and set event handlers
        const rap = rapRef.current?.audioEl.current
        if (rap) {
            rap.oncanplay = () => setPlayerStatus(PlayerState.PAUSED)
            rap.onended = () => setPlayerStatus(PlayerState.PAUSED)
            rap.onpause = () => setPlayerStatus(PlayerState.PAUSED)
            rap.onplay = () => setPlayerStatus(PlayerState.PLAYING)
            rap.onplaying = () => setPlayerStatus(PlayerState.PLAYING)
            rap.onseeking = () => setPlayerStatus(PlayerState.LOADING)
            rap.onwaiting = () => setPlayerStatus(PlayerState.LOADING)
            rap.onerror = () => setPlayerStatus(PlayerState.PAUSED)
            rap.onvolumechange = () => setPlayerVolume(rap.volume)
        }
    }, [])

    const hasThumbnail = thumbnailUrl && !brokenThumbnail
    const isPlaying = playerStatus === PlayerState.PLAYING
    const isLoading = playerStatus === PlayerState.LOADING

    return (
        <div className="flex flex-col space-y-4 md:flex-row md:space-x-4">
            {/* Album art / icon */}
            <div className="relative flex aspect-square w-full items-center justify-center rounded-lg bg-gray-100 transition-all duration-75 dark:bg-gray-700/50 md:w-48">
                {/* Loading overlay */}
                <div
                    className={`absolute z-20 flex h-full w-full items-center justify-center rounded-lg transition-all duration-300 ${isLoading
                            ? 'bg-white/80 dark:bg-gray-800/80'
                            : 'bg-transparent opacity-0'
                        }`}
                >
                    <FontAwesomeIcon
                        icon="spinner"
                        className="h-5 w-5 animate-spin text-gray-500"
                    />
                </div>

                {hasThumbnail ? (
                    <div className="absolute m-4 aspect-square w-[calc(100%-2rem)] rounded-full shadow-lg overflow-hidden">
                        <img
                            className={`h-full w-full rounded-full object-cover object-center ${isPlaying ? 'animate-spin-slow' : ''
                                }`}
                            src={thumbnailUrl}
                            alt={fileName}
                            onError={() => setBrokenThumbnail(true)}
                        />
                    </div>
                ) : (
                    <FontAwesomeIcon
                        icon="music"
                        className={`z-10 h-16 w-16 text-gray-400 ${isPlaying ? 'animate-spin-slow' : ''}`}
                    />
                )}
            </div>

            {/* File info and player */}
            <div className="flex w-full flex-col justify-between">
                <div className="mb-2">
                    <h3 className="mb-2 font-medium text-gray-900 dark:text-white">
                        {fileName}
                    </h3>
                    {modifiedTime && (
                        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                            Last modified: {formatDate(modifiedTime)}
                        </p>
                    )}
                </div>

                <ReactAudioPlayer
                    className="h-11 w-full"
                    src={audioUrl}
                    ref={rapRef}
                    controls
                    preload="auto"
                    volume={playerVolume}
                    autoPlay
                />
            </div>
        </div>
    )
}

export default AudioPlayer
