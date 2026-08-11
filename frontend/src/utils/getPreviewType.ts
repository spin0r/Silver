/**
 * Code file detection and language mapping for syntax highlighting.
 * Languages use Prism identifiers (prism-react-renderer).
 */

const CODE_EXTENSIONS = new Set([
    'js', 'jsx', 'ts', 'tsx',
    'py', 'c', 'cpp', 'h', 'hpp',
    'java', 'cs', 'rs', 'go', 'rb', 'php',
    'sh', 'bash', 'zsh', 'ps1',
    'css', 'scss', 'less', 'html', 'vue', 'svelte',
    'json', 'yml', 'yaml', 'toml', 'xml', 'ini', 'env',
    'sql', 'graphql', 'gql',
    'dockerfile', 'makefile',
    'lua', 'perl', 'r', 'swift', 'kt', 'kts',
    'dart', 'zig', 'nim', 'elixir', 'ex', 'exs',
    'bat', 'cmd',
])

function getExtension(filename: string): string {
    // Handle extensionless files like Dockerfile, Makefile
    const lower = filename.toLowerCase()
    if (lower === 'dockerfile') return 'dockerfile'
    if (lower === 'makefile') return 'makefile'
    if (lower === '.env' || lower.startsWith('.env.')) return 'env'

    return (filename.split('.').pop() || '').toLowerCase()
}

export function isCodeFile(filename: string): boolean {
    return CODE_EXTENSIONS.has(getExtension(filename))
}

export function getLanguageByFileName(filename: string): string {
    const ext = getExtension(filename)
    switch (ext) {
        case 'ts':
        case 'tsx':
            return 'typescript'
        case 'js':
        case 'jsx':
            return 'javascript'
        case 'rs':
            return 'rust'
        case 'sh':
        case 'bash':
        case 'zsh':
            return 'bash'
        case 'cs':
            return 'csharp'
        case 'py':
            return 'python'
        case 'rb':
            return 'ruby'
        case 'yml':
            return 'yaml'
        case 'kt':
        case 'kts':
            return 'kotlin'
        case 'hpp':
        case 'cpp':
            return 'cpp'
        case 'h':
            return 'c'
        case 'ex':
        case 'exs':
            return 'elixir'
        case 'gql':
        case 'graphql':
            return 'graphql'
        case 'ps1':
            return 'powershell'
        case 'bat':
        case 'cmd':
            return 'bash'
        case 'env':
        case 'ini':
            return 'ini'
        default:
            return ext
    }
}
