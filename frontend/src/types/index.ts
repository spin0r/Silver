// Types for Google Drive API responses

// Augment the global Window interface for worker-injected globals
declare global {
    interface Window {
        drive_names: string[]
        current_drive_order: number
        SITE_NAME: string
        UI: {
            favicon?: string
            copyright_year?: string
            company_name?: string
            downloaddomain?: string
            show_logout_button?: boolean
            enable_delete?: boolean
            enable_rename?: boolean
            player_js?: string
            player_css?: string
        }
        MODEL: Record<string, unknown>
        DRIVE_CONFIG?: {
            siteName: string
            driveNames: string[]
            currentDrive: number
        }
    }
}

export interface DriveFile {
    id: string
    name: string
    mimeType: string
    size?: string
    modifiedTime?: string
    createdTime?: string
    fileExtension?: string
    link?: string
    path?: string
    driveId?: string
    thumbnailLink?: string
}


export interface FolderListResponse {
    nextPageToken: string | null
    curPageIndex: number
    data: {
        files: DriveFile[]
    }
}

export interface SearchResponse {
    nextPageToken: string | null
    curPageIndex: number
    data: {
        files: DriveFile[]
    }
}

export type LayoutType = 'list' | 'grid'

export interface SiteConfig {
    siteName: string
    apiBase: string
    theme: string
}
