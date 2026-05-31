import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useFamily } from '../context/FamilyContext'
import { formatDateLabel, getFullName, getInitials } from '../lib/familyData'
import type { Gender, Person, PersonPhoto, PhotoLabel } from '../types/family'

const PHOTO_TABS: Array<{ label: string; value: PhotoLabel }> = [
  { label: 'Bayi', value: 'baby' },
  { label: 'Anak-anak', value: 'kids' },
  { label: 'Sekarang', value: 'now' },
]

function buildTreeSearch(personId: string) {
  const params = new URLSearchParams()
  const token = Date.now().toString()

  params.set('focus', personId)
  params.set('pulse', personId)
  params.set('pulseToken', token)

  return `?${params.toString()}`
}

function AvatarChip({ person }: { person: Person }) {
  return (
    <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/60 bg-muted-gold/80 text-xs font-semibold text-cream shadow-sm">
      {person.profileImageUrl ? (
        <img alt={getFullName(person)} className="h-full w-full object-cover" src={person.profileImageUrl} />
      ) : (
        getInitials(person)
      )}
    </span>
  )
}

function PlaceholderSilhouette({ gender }: { gender: Gender }) {
  const faceFill = gender === 'female' ? '#F5D0B5' : gender === 'male' ? '#E6C0A2' : '#EBC8B0'
  const hairFill = gender === 'female' ? '#7C4A2D' : gender === 'male' ? '#5A3B27' : '#6A573C'

  return (
    <svg className="h-full w-full" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hero-bg" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#F9E8D2" />
          <stop offset="55%" stopColor="#FFF8F0" />
          <stop offset="100%" stopColor="#D7E1CE" />
        </linearGradient>
      </defs>
      <rect fill="url(#hero-bg)" height="300" width="400" />
      <circle cx="200" cy="122" fill={faceFill} r="52" />
      <path
        d={
          gender === 'female'
            ? 'M143 123C143 81 168 58 200 58C232 58 257 81 257 123V145C240 132 224 126 200 126C176 126 160 132 143 145V123Z'
            : gender === 'male'
              ? 'M150 118C150 82 172 62 200 62C228 62 250 82 250 118V130C238 116 221 108 200 108C179 108 162 116 150 130V118Z'
              : 'M146 121C146 80 170 60 200 60C230 60 254 80 254 121V138C239 124 221 118 200 118C179 118 161 124 146 138V121Z'
        }
        fill={hairFill}
      />
      <path
        d="M126 255C126 208 159 176 200 176C241 176 274 208 274 255V276H126V255Z"
        fill="#C9943A"
        fillOpacity="0.92"
      />
      <path
        d="M92 278C104 238 144 210 200 210C256 210 296 238 308 278H92Z"
        fill="#5A7A4A"
        fillOpacity="0.23"
      />
    </svg>
  )
}

function ParentLink({
  label,
  onOpen,
  parent,
}: {
  label: 'Ayah' | 'Ibu'
  onOpen: (person: Person) => void
  parent: Person | null
}) {
  return (
    <div className="rounded-[1.35rem] border border-warm-brown/10 bg-cream/65 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.24em] text-soft-green">{label}</p>
      {parent ? (
        <button
          className="mt-3 flex items-center gap-3 text-sm text-warm-brown transition hover:text-soft-green"
          onClick={() => onOpen(parent)}
          type="button"
        >
          <AvatarChip person={parent} />
          <span className="font-medium">{getFullName(parent)}</span>
        </button>
      ) : (
        <p className="mt-3 text-sm text-warm-brown/55">Tidak diketahui</p>
      )}
    </div>
  )
}

function CollapseBiography({ biography }: { biography: string }) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setExpanded(false)
  }, [biography])

  return (
    <div>
      <p className={`text-sm leading-7 text-warm-brown/78 ${expanded ? '' : 'line-clamp-3'}`}>
        {biography || 'Belum ada biografi.'}
      </p>
      {biography ? (
        <button
          className="mt-3 text-sm font-medium text-soft-green transition hover:text-warm-brown"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? 'Ringkas' : 'Selengkapnya'}
        </button>
      ) : null}
    </div>
  )
}

function PlayIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path d="M8 6.75V17.25L17 12L8 6.75Z" fill="currentColor" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path d="M8 6.75H10.75V17.25H8V6.75Z" fill="currentColor" />
      <path d="M13.25 6.75H16V17.25H13.25V6.75Z" fill="currentColor" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path d="M6 6L18 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      <path d="M18 6L6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  )
}

function useCarouselSlides(photos: PersonPhoto[]) {
  return useMemo(
    () =>
      PHOTO_TABS.reduce<Record<PhotoLabel, PersonPhoto[]>>(
        (accumulator, tab) => ({
          ...accumulator,
          [tab.value]: photos.filter((photo) => photo.label === tab.value),
        }),
        {
          baby: [],
          kids: [],
          now: [],
        },
      ),
    [photos],
  )
}

function PhotoCarousel({
  person,
}: {
  person: Person
}) {
  const navigate = useNavigate()
  const groupedPhotos = useCarouselSlides(person.photos)
  const [activeTab, setActiveTab] = useState<PhotoLabel>('baby')
  const [activeIndexes, setActiveIndexes] = useState<Record<PhotoLabel, number>>({
    baby: 0,
    kids: 0,
    now: 0,
  })
  const [loadedPhotos, setLoadedPhotos] = useState<Record<string, boolean>>({})
  const dragStateRef = useRef<{ pointerId: number; startX: number } | null>(null)
  const tabPhotos = groupedPhotos[activeTab]
  const activeIndex = Math.min(activeIndexes[activeTab] ?? 0, Math.max(tabPhotos.length - 1, 0))
  const activePhoto = tabPhotos[activeIndex]

  useEffect(() => {
    setActiveIndexes((current) => ({
      baby: Math.min(current.baby, Math.max(groupedPhotos.baby.length - 1, 0)),
      kids: Math.min(current.kids, Math.max(groupedPhotos.kids.length - 1, 0)),
      now: Math.min(current.now, Math.max(groupedPhotos.now.length - 1, 0)),
    }))
  }, [groupedPhotos])

  function moveSlide(direction: number) {
    if (tabPhotos.length === 0) {
      return
    }

    setActiveIndexes((current) => ({
      ...current,
      [activeTab]: (current[activeTab] + direction + tabPhotos.length) % tabPhotos.length,
    }))
  }

  return (
    <section className="rounded-[1.8rem] border border-warm-brown/10 bg-white/70 p-5 shadow-[0_18px_48px_rgba(124,74,45,0.07)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.26em] text-soft-green">Perjalanan Hidup</p>
          <h3 className="mt-2 font-serif text-2xl text-warm-brown">Album momen yang ingin dikenang.</h3>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 rounded-[1.3rem] bg-cream/80 p-1.5">
        {PHOTO_TABS.map((tab) => (
          <button
            className={`rounded-[1rem] px-3 py-2 text-sm transition ${
              activeTab === tab.value
                ? 'bg-soft-green text-cream shadow-sm'
                : 'text-warm-brown/70 hover:bg-white/80'
            }`}
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <div
          className="relative overflow-hidden rounded-[1.7rem] border border-warm-brown/10 bg-cream/60"
          onPointerDown={(event) => {
            dragStateRef.current = { pointerId: event.pointerId, startX: event.clientX }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerUp={(event) => {
            if (!dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) {
              return
            }

            const deltaX = event.clientX - dragStateRef.current.startX
            if (Math.abs(deltaX) > 44) {
              moveSlide(deltaX < 0 ? 1 : -1)
            }

            dragStateRef.current = null
          }}
        >
          <div className="aspect-[4/3]">
            {tabPhotos.length > 0 ? (
              tabPhotos.map((photo, index) => (
                <div
                  className={`carousel-fade absolute inset-0 ${
                    index === activeIndex ? 'opacity-100' : 'pointer-events-none opacity-0'
                  }`}
                  key={photo.id}
                >
                  {!loadedPhotos[photo.id] ? <div className="skeleton-shimmer absolute inset-0" /> : null}
                  <img
                    alt={`${getFullName(person)} - ${photo.label}`}
                    className={`h-full w-full object-cover transition-opacity duration-200 ${
                      loadedPhotos[photo.id] ? 'opacity-100' : 'opacity-0'
                    }`}
                    onLoad={() =>
                      setLoadedPhotos((current) => ({
                        ...current,
                        [photo.id]: true,
                      }))
                    }
                    src={photo.url}
                  />
                </div>
              ))
            ) : (
              <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,rgba(255,248,240,0.92),rgba(201,148,58,0.15),rgba(90,122,74,0.12))] px-6 text-center">
                <div>
                  <p className="font-serif text-2xl text-warm-brown">Belum ada foto {PHOTO_TABS.find((tab) => tab.value === activeTab)?.label.toLowerCase()}.</p>
                  <p className="mt-2 text-sm text-warm-brown/65">
                    Tambahkan foto untuk melengkapi perjalanan hidup anggota keluarga ini.
                  </p>
                </div>
              </div>
            )}
          </div>

          {tabPhotos.length > 1 ? (
            <>
              <button
                className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/88 text-warm-brown shadow-[0_10px_24px_rgba(124,74,45,0.15)] transition hover:bg-white"
                onClick={() => moveSlide(-1)}
                type="button"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <path d="M14.5 6L8.5 12L14.5 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                </svg>
              </button>
              <button
                className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/88 text-warm-brown shadow-[0_10px_24px_rgba(124,74,45,0.15)] transition hover:bg-white"
                onClick={() => moveSlide(1)}
                type="button"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <path d="M9.5 6L15.5 12L9.5 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                </svg>
              </button>
            </>
          ) : null}

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {tabPhotos.map((photo, index) => (
              <button
                className={`h-2.5 rounded-full transition ${index === activeIndex ? 'w-7 bg-cream' : 'w-2.5 bg-cream/55'}`}
                key={`${photo.id}-dot`}
                onClick={() =>
                  setActiveIndexes((current) => ({
                    ...current,
                    [activeTab]: index,
                  }))
                }
                type="button"
              >
                <span className="sr-only">Slide {index + 1}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {tabPhotos.map((photo, index) => (
            <button
              className={`relative overflow-hidden rounded-[1rem] border transition ${
                index === activeIndex
                  ? 'border-soft-green shadow-[0_0_0_2px_rgba(90,122,74,0.12)]'
                  : 'border-warm-brown/10 hover:border-soft-green/30'
              }`}
              key={`${photo.id}-thumb`}
              onClick={() =>
                setActiveIndexes((current) => ({
                  ...current,
                  [activeTab]: index,
                }))
              }
              type="button"
            >
              {!loadedPhotos[photo.id] ? <div className="skeleton-shimmer absolute inset-0" /> : null}
              <img
                alt=""
                className={`aspect-[4/3] h-full w-full object-cover transition-opacity duration-200 ${
                  loadedPhotos[photo.id] ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() =>
                  setLoadedPhotos((current) => ({
                    ...current,
                    [photo.id]: true,
                  }))
                }
                src={photo.url}
              />
            </button>
          ))}
        </div>

        <button
          className="mt-4 inline-flex rounded-full border border-soft-green/20 bg-soft-green/10 px-4 py-2.5 text-sm text-soft-green transition hover:bg-soft-green hover:text-cream"
          onClick={() => navigate(`/edit/${person.id}`)}
          type="button"
        >
          Tambah foto
        </button>

        {activePhoto ? (
          <p className="mt-3 text-xs uppercase tracking-[0.22em] text-warm-brown/45">
            {PHOTO_TABS.find((tab) => tab.value === activeTab)?.label} · {activeIndex + 1} / {tabPhotos.length}
          </p>
        ) : null}
      </div>
    </section>
  )
}

function ConfirmDeleteModal({
  name,
  onCancel,
  onConfirm,
}: {
  name: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-warm-brown/35 px-5 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[1.8rem] bg-white p-6 shadow-[0_24px_70px_rgba(124,74,45,0.2)]">
        <p className="text-[11px] uppercase tracking-[0.26em] text-soft-green">Konfirmasi</p>
        <h3 className="mt-3 font-serif text-2xl text-warm-brown">Hapus {name}?</h3>
        <p className="mt-3 text-sm leading-7 text-warm-brown/72">
          Data akan dihapus dari perangkat ini dan relasi orang tua pada anggota lain akan dikosongkan.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            className="rounded-full border border-warm-brown/15 px-4 py-3 text-sm text-warm-brown transition hover:bg-cream"
            onClick={onCancel}
            type="button"
          >
            Batal
          </button>
          <button
            className="rounded-full bg-red-600 px-4 py-3 text-sm text-white transition hover:bg-red-700"
            onClick={onConfirm}
            type="button"
          >
            Hapus
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PersonDetailPanel() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { persons, deletePerson } = useFamily()
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isVideoPlaying, setIsVideoPlaying] = useState(true)
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const person = persons.find((entry) => entry.id === id)
  const father = person?.fatherId ? persons.find((entry) => entry.id === person.fatherId) ?? null : null
  const mother = person?.motherId ? persons.find((entry) => entry.id === person.motherId) ?? null : null

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsVisible(true)
      setIsClosing(false)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [id])

  useEffect(() => {
    setShowDeleteModal(false)
    setIsVideoPlaying(true)
    setShouldLoadVideo(Boolean(person?.profileVideoUrl))
  }, [person?.id, person?.profileVideoUrl])

  function closePanel(to: string) {
    setIsClosing(true)
    window.setTimeout(() => navigate(to), 300)
  }

  async function syncVideoState(nextPlay: boolean) {
    const video = videoRef.current
    if (!video) {
      return
    }

    if (nextPlay) {
      try {
        await video.play()
        setIsVideoPlaying(true)
      } catch {
        setIsVideoPlaying(false)
      }
      return
    }

    video.pause()
    setIsVideoPlaying(false)
  }

  if (!person) {
    return (
      <aside className="fixed inset-0 z-40 bg-warm-brown/28 backdrop-blur-sm">
        <div className="absolute bottom-0 left-0 right-0 h-[95vh] rounded-t-[2rem] bg-white p-6 shadow-[0_-30px_80px_rgba(124,74,45,0.22)] xl:bottom-0 xl:left-auto xl:right-0 xl:top-0 xl:h-full xl:w-[420px] xl:rounded-none xl:rounded-l-[2rem]">
          <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-warm-brown/15 xl:hidden" />
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl text-warm-brown">Anggota tidak ditemukan</h2>
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-warm-brown/15 text-warm-brown/70 transition hover:bg-warm-brown/5"
              onClick={() => closePanel('/')}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>
          <p className="mt-4 text-sm leading-7 text-warm-brown/72">
            Data yang Anda cari mungkin sudah dihapus atau belum tersimpan di perangkat ini.
          </p>
        </div>
      </aside>
    )
  }

  const panelMotionClass =
    isVisible && !isClosing
      ? 'translate-y-0 xl:translate-x-0'
      : 'translate-y-full xl:translate-y-0 xl:translate-x-full'

  return (
    <aside className="fixed inset-0 z-40 bg-warm-brown/28 backdrop-blur-sm">
      <button
        aria-label="Tutup panel detail"
        className="absolute inset-0"
        onClick={() => closePanel('/')}
        type="button"
      />

      <section
        className={`panel-motion absolute bottom-0 left-0 right-0 flex h-[95vh] flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-[0_-30px_80px_rgba(124,74,45,0.22)] xl:bottom-0 xl:left-auto xl:right-0 xl:top-0 xl:h-full xl:w-[420px] xl:rounded-none xl:rounded-l-[2rem] xl:shadow-[-20px_0_70px_rgba(124,74,45,0.16)] ${panelMotionClass}`}
      >
        {showDeleteModal ? (
          <ConfirmDeleteModal
            name={getFullName(person)}
            onCancel={() => setShowDeleteModal(false)}
            onConfirm={() => {
              deletePerson(person.id)
              closePanel('/')
            }}
          />
        ) : null}

        <div className="relative z-10 flex items-center justify-between px-5 pb-3 pt-3 xl:px-6 xl:pt-4">
          <div className="mx-auto h-1.5 w-14 rounded-full bg-warm-brown/15 xl:hidden" />
          <button
            className="absolute right-5 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/35 bg-white/75 text-warm-brown shadow-sm backdrop-blur transition hover:bg-white xl:right-6 xl:top-4"
            onClick={() => closePanel('/')}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 xl:px-6">
          <section className="overflow-hidden rounded-[2rem] border border-warm-brown/10 bg-cream shadow-[0_20px_50px_rgba(124,74,45,0.08)]">
            <div className="relative aspect-[4/3] overflow-hidden bg-[linear-gradient(135deg,rgba(255,248,240,0.96),rgba(201,148,58,0.16),rgba(90,122,74,0.14))]">
              {person.profileVideoUrl && shouldLoadVideo ? (
                <>
                  <video
                    autoPlay
                    className="h-full w-full object-cover"
                    loop
                    muted
                    playsInline
                    preload="none"
                    ref={videoRef}
                    src={person.profileVideoUrl}
                  />
                  <button
                    className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-warm-brown shadow-[0_10px_24px_rgba(124,74,45,0.18)] backdrop-blur transition hover:bg-white"
                    onClick={() => {
                      void syncVideoState(!isVideoPlaying)
                    }}
                    type="button"
                  >
                    <span className="sr-only">{isVideoPlaying ? 'Pause video' : 'Putar video'}</span>
                    {isVideoPlaying ? <PauseIcon /> : <PlayIcon />}
                  </button>
                </>
              ) : person.profileImageUrl ? (
                <img alt={getFullName(person)} className="h-full w-full object-cover" src={person.profileImageUrl} />
              ) : (
                <PlaceholderSilhouette gender={person.gender} />
              )}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#2D170C]/88 via-[#2D170C]/42 to-transparent px-5 pb-5 pt-14">
                <p className="text-[11px] uppercase tracking-[0.28em] text-cream/70">Detail keluarga</p>
                <h2 className="mt-3 max-w-[15rem] font-serif text-4xl font-semibold leading-tight text-cream">
                  {getFullName(person)}
                </h2>
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-[1.8rem] border border-warm-brown/10 bg-white/70 p-5 shadow-[0_18px_48px_rgba(124,74,45,0.07)]">
            <p className="text-[11px] uppercase tracking-[0.26em] text-soft-green">Orang tua</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ParentLink
                label="Ayah"
                onOpen={(parentPerson) => closePanel(`/person/${parentPerson.id}${buildTreeSearch(parentPerson.id)}`)}
                parent={father}
              />
              <ParentLink
                label="Ibu"
                onOpen={(parentPerson) => closePanel(`/person/${parentPerson.id}${buildTreeSearch(parentPerson.id)}`)}
                parent={mother}
              />
            </div>
          </section>

          <section className="mt-5 rounded-[1.8rem] border border-warm-brown/10 bg-white/70 p-5 shadow-[0_18px_48px_rgba(124,74,45,0.07)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.26em] text-soft-green">Biografi</p>
                <h3 className="mt-2 font-serif text-2xl text-warm-brown">Cerita hidup dan jejak waktu.</h3>
              </div>
              <div className="rounded-[1.2rem] bg-cream/80 px-4 py-3 text-right text-xs leading-6 text-warm-brown/68">
                <p>Lahir: {formatDateLabel(person.birthDate)}</p>
                <p>Wafat: {person.deathDate ? formatDateLabel(person.deathDate) : 'Masih hidup'}</p>
              </div>
            </div>
            <div className="mt-5">
              <CollapseBiography biography={person.biography} />
            </div>
          </section>

          <div className="mt-5">
            <PhotoCarousel person={person} />
          </div>
        </div>

        <footer className="border-t border-warm-brown/10 bg-white/92 px-5 py-4 backdrop-blur xl:px-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              className="rounded-full border border-soft-green/20 bg-soft-green/10 px-4 py-3 text-center text-sm text-soft-green transition hover:bg-soft-green hover:text-cream"
              to={`/edit/${person.id}`}
            >
              Edit
            </Link>
            <button
              className="rounded-full border border-warm-brown/15 px-4 py-3 text-sm text-warm-brown transition hover:bg-cream"
              onClick={() => closePanel(`/${buildTreeSearch(person.id)}`)}
              type="button"
            >
              Lihat di pohon
            </button>
            <button
              className="rounded-full border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 transition hover:bg-red-100"
              onClick={() => setShowDeleteModal(true)}
              type="button"
            >
              Hapus
            </button>
          </div>
        </footer>
      </section>
    </aside>
  )
}
