import { Route, Routes } from 'react-router-dom'
import { FamilyProvider } from './context/FamilyContext'
import AppShell from './components/AppShell'
import PersonDetailPanel from './components/PersonDetailPanel'
import ExportPage from './pages/ExportPage'
import HomePage from './pages/HomePage'
import PersonFormPage from './pages/PersonFormPage'

function NotFoundPage() {
  return (
    <section className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center rounded-[2rem] border border-warm-brown/10 bg-white/70 px-6 py-12 text-center shadow-[0_30px_80px_rgba(124,74,45,0.08)]">
      <p className="text-sm uppercase tracking-[0.3em] text-soft-green">Tidak ditemukan</p>
      <h1 className="mt-4 font-serif text-4xl text-warm-brown">Halaman ini belum punya akar.</h1>
      <p className="mt-3 max-w-xl text-sm text-warm-brown/70 sm:text-base">
        Coba kembali ke beranda keluarga untuk melihat silsilah, menambah anggota baru, atau mengekspor data cerita keluarga.
      </p>
    </section>
  )
}

export default function App() {
  return (
    <FamilyProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />}>
            <Route path="person/:id" element={<PersonDetailPanel />} />
          </Route>
          <Route path="/add" element={<PersonFormPage mode="add" />} />
          <Route path="/edit/:id" element={<PersonFormPage mode="edit" />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </FamilyProvider>
  )
}
