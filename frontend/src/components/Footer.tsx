const Footer = () => {
    return (
        <footer className="border-t border-gray-200/50 bg-white/50 py-4 text-center text-sm text-gray-500 dark:border-gray-700/50 dark:bg-[#18181B] dark:text-gray-400">
            <div className="mx-auto max-w-6xl px-4">
                <p>
                    Powered by{' '}
                    <a
                        href="https://github.com/Fluxonide/Google-Drive-Index"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                    >
                        Google Drive Index
                    </a>
                    {' '}• Built with React + Tailwind CSS
                </p>
            </div>
        </footer>
    )
}

export default Footer
