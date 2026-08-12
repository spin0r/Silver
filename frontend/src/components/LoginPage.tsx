import { useState, useEffect, FormEvent } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const LoginPage = () => {
    const { login, attemptsLeft, isBlocked } = useAuth()
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const isIpBlocked = isBlocked || attemptsLeft <= 0

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!password.trim() || isIpBlocked || submitting) return

        setSubmitting(true)
        setErrorMsg(null)

        try {
            await login(password.trim())
            toast.success('Authenticated successfully!')
        } catch (err: any) {
            const msg = err.message || 'Incorrect password'
            setErrorMsg(msg)
            toast.error(msg)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="flex min-h-[85vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8 rounded-2xl border border-gray-200/60 bg-white/90 p-8 shadow-xl backdrop-blur-xl dark:border-gray-800/80 dark:bg-[#18181B]/90 dark:shadow-2xl">
                {/* Header */}
                <div className="text-center">
                    <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition-colors ${
                        isIpBlocked ? 'bg-red-600 text-white dark:bg-red-600' : 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    }`}>
                        <FontAwesomeIcon icon={isIpBlocked ? 'shield-cat' : 'lock'} className="h-7 w-7" />
                    </div>
                    <h2 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                        {isIpBlocked ? 'IP Address Blocked' : 'Protected Access'}
                    </h2>
                </div>

                {/* Error Banner */}
                {(errorMsg || isIpBlocked) && (
                    <div className="flex items-center space-x-2 rounded-lg border border-red-200/60 bg-red-50/70 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
                        <FontAwesomeIcon icon="exclamation-circle" className="h-4 w-4 shrink-0 text-red-500" />
                        <span>{errorMsg || 'Access Denied: Your IP address is blocked.'}</span>
                    </div>
                )}

                {/* Form */}
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div>
                        <label
                            htmlFor="password"
                            className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400"
                        >
                            Password
                        </label>
                        <div className="relative mt-2">
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                required
                                disabled={isIpBlocked || submitting}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={isIpBlocked ? 'Access Blocked' : 'Enter password...'}
                                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pr-10 text-sm text-gray-900 transition-all placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-white dark:focus:ring-white/10 disabled:opacity-50"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <FontAwesomeIcon icon={showPassword ? 'eye-slash' : 'eye'} className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isIpBlocked || submitting || !password.trim()}
                        className="group relative flex w-full justify-center rounded-xl border border-transparent bg-gray-900 py-3.5 text-sm font-semibold text-white transition-all hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 active:scale-[0.99] dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50"
                    >
                        {submitting ? (
                            <div className="flex items-center space-x-2">
                                <FontAwesomeIcon icon="spinner" className="h-4 w-4 animate-spin" />
                                <span>Verifying...</span>
                            </div>
                        ) : isIpBlocked ? (
                            <span>IP Address Blocked</span>
                        ) : (
                            <span>Unlock Access</span>
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default LoginPage
