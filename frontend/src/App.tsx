import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import FileListing from './components/FileListing'
import LoginPage from './components/LoginPage'
import Loading from './components/Loading'
import AdminPage from './components/AdminPage'
import { AuthProvider, useAuth } from './context/AuthContext'

function AppContent() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading text="Verifying session..." />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] flex-col bg-gray-50 dark:bg-[#121214]">
        <main className="flex-1">
          <Routes>
            <Route path="/main" element={<AdminPage />} />
            <Route path="/*" element={<LoginPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col">
      <Navbar />

      <main className="flex-1">
        <Routes>
          <Route path="/main" element={<AdminPage />} />
          {/* Catch-all route for folder/file paths */}
          <Route path="/*" element={<FileListing />} />
        </Routes>
      </main>

      <Footer />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
