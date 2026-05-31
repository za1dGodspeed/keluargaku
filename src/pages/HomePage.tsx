import { Link, Outlet, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import FamilyTreeCanvas from '../components/FamilyTreeCanvas'
import { useFamily } from '../context/FamilyContext'
import type { AppShellOutletContext } from '../components/AppShell'

function HomeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.75rem] border border-warm-brown/10 bg-white/70 px-5 py-4 shadow-[0_20px_50px_rgba(124,74,45,0.06)]">
      <p className="text-xs uppercase tracking-[0.28em] text-soft-green">{label}</p>
      <p className="mt-3 font-serif text-3xl text-warm-brown">{value}</p>
    </div>
  )
}

export default function HomePage() {
  const { id: selectedId } = useParams()
  const [searchParams] = useSearchParams()
  const { persons } = useFamily()
  const { deferredSearchQuery } = useOutletContext<AppShellOutletContext>()
  const livingCount = persons.filter((person) => !person.deathDate).length
  const memoriesCount = persons.filter((person) => person.photos.length > 0 || person.biography).length
  const focusId = searchParams.get('focus') ?? undefined
  const pulseId = searchParams.get('pulse') ?? undefined
  const pulseToken = searchParams.get('pulseToken') ?? undefined

  return (
    <div className="grid gap-6">
      <section className="space-y-6">
        <div className="overflow-hidden rounded-[2rem] border border-warm-brown/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(255,248,240,0.8),rgba(201,148,58,0.14))] p-6 shadow-[0_28px_70px_rgba(124,74,45,0.08)]">
          <p className="text-xs uppercase tracking-[0.32em] text-soft-green">Pohon keluarga digital</p>
          <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-tight text-warm-brown sm:text-5xl">
            Rawat nama, foto, dan kisah keluarga dalam satu ruang yang hangat.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-warm-brown/70 sm:text-base">
            Jelajahi hubungan antargenerasi, buka detail tiap anggota, lalu tambahkan cerita baru saat kenangan datang kembali.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="rounded-full bg-soft-green px-5 py-3 text-sm text-cream transition hover:bg-warm-brown"
              to="/add"
            >
              Tambah anggota baru
            </Link>
            <Link
              className="rounded-full border border-warm-brown/15 px-5 py-3 text-sm text-warm-brown transition hover:bg-white/75"
              to="/export"
            >
              Export arsip keluarga
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <HomeStat label="Total anggota" value={String(persons.length)} />
          <HomeStat label="Masih hidup" value={String(livingCount)} />
          <HomeStat label="Memori tersimpan" value={String(memoriesCount)} />
        </div>

        <FamilyTreeCanvas
          focusId={focusId}
          persons={persons}
          pulseId={pulseId}
          pulseToken={pulseToken}
          searchQuery={deferredSearchQuery}
          selectedId={selectedId}
        />
      </section>

      <Outlet />
    </div>
  )
}
