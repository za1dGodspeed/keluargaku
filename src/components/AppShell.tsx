import { startTransition, useDeferredValue, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import TreeLogo from './TreeLogo'

export interface AppShellOutletContext {
  searchQuery: string
  deferredSearchQuery: string
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-2 text-sm transition ${
    isActive ? 'bg-soft-green text-cream shadow-sm' : 'text-warm-brown/75 hover:bg-warm-brown/5'
  }`

export default function AppShell() {
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)

  return (
    <div className="min-h-screen bg-cream text-warm-brown">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(201,148,58,0.14),_transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.5),rgba(255,248,240,0.96))]" />
      <div className="app-leaf-pattern pointer-events-none fixed inset-0" />
      <div className="relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-warm-brown/10 bg-cream/85 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <Link className="flex items-center gap-3" to="/">
              <TreeLogo className="h-11 w-11" />
              <div>
                <p className="font-serif text-2xl text-warm-brown">Keluargaku</p>
                <p className="text-xs uppercase tracking-[0.22em] text-soft-green">Arsip keluarga</p>
              </div>
            </Link>

            <div className="order-3 w-full flex-1 sm:order-none sm:min-w-[16rem]">
              <label className="sr-only" htmlFor="family-search">
                Cari nama keluarga
              </label>
              <div className="flex items-center gap-3 rounded-full border border-warm-brown/15 bg-white/75 px-4 py-3 shadow-[0_10px_35px_rgba(124,74,45,0.07)]">
                <svg className="h-4 w-4 text-soft-green" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    clipRule="evenodd"
                    d="M8.5 3a5.5 5.5 0 1 0 3.473 9.765l3.63 3.631a.75.75 0 1 0 1.06-1.061l-3.63-3.63A5.5 5.5 0 0 0 8.5 3ZM4.5 8.5a4 4 0 1 1 8 0a4 4 0 0 1-8 0Z"
                    fillRule="evenodd"
                  />
                </svg>
                <input
                  id="family-search"
                  className="w-full bg-transparent text-sm text-warm-brown outline-none placeholder:text-warm-brown/40"
                  onChange={(event) => {
                    const value = event.target.value
                    startTransition(() => setSearchQuery(value))
                  }}
                  placeholder="Cari nama keluarga..."
                  type="search"
                  value={searchQuery}
                />
              </div>
            </div>

            <nav className="ml-auto flex items-center gap-2">
              <NavLink className={navLinkClass} to="/" end>
                Beranda
              </NavLink>
              <NavLink className={navLinkClass} to="/export">
                Export
              </NavLink>
              <Link
                aria-label="Tambah anggota keluarga"
                className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted-gold text-2xl text-cream shadow-[0_14px_30px_rgba(201,148,58,0.35)] transition hover:scale-[1.02] hover:bg-warm-brown"
                to="/add"
              >
                +
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-10 pt-6 sm:px-6 lg:px-8">
          <Outlet context={{ searchQuery, deferredSearchQuery } satisfies AppShellOutletContext} />
        </main>

        <footer className="border-t border-warm-brown/10 bg-white/55">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-5 text-sm text-warm-brown/70 sm:px-6 lg:px-8">
            <p>Simpan cerita, jaga warisan.</p>
            <p className="font-serif text-base text-soft-green">Kisah keluarga yang selalu dekat.</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
