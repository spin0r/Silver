import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { API_BASE, getAuthToken, clearFolderCache } from '../utils/api'

interface AuthContextType {
    isAuthenticated: boolean
    loading: boolean
    attemptsLeft: number
    lockUntil: number
    isBlocked: boolean
    passwordEnabled: boolean
    login: (password: string) => Promise<void>
    logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
    const [loading, setLoading] = useState<boolean>(true)
    const [attemptsLeft, setAttemptsLeft] = useState<number>(2)
    const [lockUntil, setLockUntil] = useState<number>(0)
    const [isBlocked, setIsBlocked] = useState<boolean>(false)
    const [passwordEnabled, setPasswordEnabled] = useState<boolean>(true)

    const checkAuth = async () => {
        setLoading(true)
        const token = getAuthToken()
        try {
            const url = token ? `${API_BASE}/auth/verify?token=${encodeURIComponent(token)}` : `${API_BASE}/auth/verify`
            const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
            const res = await fetch(url, { headers })
            if (!res.ok) {
                throw new Error(`Verify returned ${res.status}`)
            }
            const data = await res.json()
            // If the server has disabled the password system, skip auth entirely
            if (data.passwordEnabled === false) {
                setPasswordEnabled(false)
                setIsAuthenticated(true)
                setIsBlocked(false)
                setAttemptsLeft(2)
            } else {
                setPasswordEnabled(true)
                setIsAuthenticated(Boolean(data.authenticated))
                setAttemptsLeft(data.attemptsLeft ?? 2)
                setLockUntil(data.lockUntil ?? 0)
                setIsBlocked(Boolean(data.isBlocked))
            }
        } catch (err) {
            console.error('Failed to verify authentication status:', err)
            setIsAuthenticated(false)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        checkAuth()
    }, [])

    const login = async (password: string) => {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        })

        const data = await res.json()

        if (res.ok && data.success && data.token) {
            localStorage.setItem('auth_token', data.token)
            setIsAuthenticated(true)
            setAttemptsLeft(2)
            setLockUntil(0)
            setIsBlocked(false)
            clearFolderCache()
        } else {
            setAttemptsLeft(data.attemptsLeft ?? 0)
            setLockUntil(data.lockUntil ?? 0)
            if (data.isBlocked || res.status === 403) {
                setIsBlocked(true)
            }
            throw new Error(data.error || 'Login failed')
        }
    }

    const logout = async () => {
        const token = getAuthToken()
        if (token) {
            try {
                await fetch(`${API_BASE}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ token })
                })
            } catch (e) {}
        }
        localStorage.removeItem('auth_token')
        setIsAuthenticated(false)
        clearFolderCache()
    }

    return (
        <AuthContext.Provider
            value={{
                isAuthenticated,
                loading,
                attemptsLeft,
                lockUntil,
                isBlocked,
                passwordEnabled,
                login,
                logout
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
