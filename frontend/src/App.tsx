import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import FileListing from './components/FileListing'

function App() {
  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col">
      <Navbar />

      <main className="flex-1">
        <Routes>
          {/* Catch-all route for folder/file paths */}
          <Route path="/*" element={<FileListing />} />
        </Routes>
      </main>

      <Footer />
    </div>
  )
}

export default App
