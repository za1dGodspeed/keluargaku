import type { FormEvent, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useFamily } from '../context/FamilyContext'
import { getFullName, getInitials } from '../lib/familyData'
import type { Gender, Person, PersonDraft, PersonPhoto, PhotoLabel } from '../types/family'

const FIELD_BASE_CLASS =
  'w-full rounded-[1.25rem] border bg-white/80 px-4 py-3 text-sm text-warm-brown outline-none transition placeholder:text-warm-brown/40 focus:border-soft-green/40 focus:ring-4 focus:ring-soft-green/10'

const STEP_LIST = [
  { description: 'Nama, waktu hidup, dan cerita singkat.', id: 1, title: 'Identity' },
  { description: 'Hubungan keluarga dan preview mini pohon.', id: 2, title: 'Family links' },
  { description: 'Unggah foto dan video kenangan.', id: 3, title: 'Photos & video' },
] as const

const PHOTO_LABELS: Array<{ label: string; value: PhotoLabel }> = [
  { label: 'Bayi', value: 'baby' },
  { label: 'Anak-anak', value: 'kids' },
  { label: 'Sekarang', value: 'now' },
]

type PersonFormMode = 'add' | 'edit'
type FieldName =
  | 'firstName'
  | 'lastName'
  | 'birthDate'
  | 'deathDate'
  | 'biography'
  | 'fatherId'
  | 'motherId'
  | 'spouseId'
  | 'profileImageUrl'
  | 'profileVideoUrl'

interface PersonFormPageProps {
  mode: PersonFormMode
}

interface PersonFormState {
  biography: string
  birthDate: string
  deathDate: string
  fatherId: string
  firstName: string
  gender: Gender
  lastName: string
  motherId: string
  photos: PersonPhoto[]
  profileImageUrl: string
  profileVideoUrl: string
  spouseId: string
}

interface DraftPayload {
  activeStep: number
  form: PersonFormState
  showDeathDate: boolean
}

interface PickerOption {
  person: Person
  subtitle: string
}

interface SearchablePersonPickerProps {
  description: string
  emptyLabel: string
  error?: string
  label: string
  onChange: (personId: string) => void
  options: PickerOption[]
  selectedId: string
  shake: boolean
}

function createEmptyState(): PersonFormState {
  return {
    biography: '',
    birthDate: '',
    deathDate: '',
    fatherId: '',
    firstName: '',
    gender: 'unknown',
    lastName: '',
    motherId: '',
    photos: [],
    profileImageUrl: '',
    profileVideoUrl: '',
    spouseId: '',
  }
}

function toDraft(state: PersonFormState): PersonDraft {
  return {
    biography: state.biography,
    birthDate: state.birthDate,
    deathDate: state.deathDate || null,
    fatherId: state.fatherId || null,
    firstName: state.firstName,
    gender: state.gender,
    lastName: state.lastName,
    motherId: state.motherId || null,
    photos: state.photos,
    profileImageUrl: state.profileImageUrl || null,
    profileVideoUrl: state.profileVideoUrl || null,
    spouseId: state.spouseId || null,
  }
}

function fromPerson(person: Person, inferredSpouseId: string | null): PersonFormState {
  return {
    biography: person.biography,
    birthDate: person.birthDate,
    deathDate: person.deathDate ?? '',
    fatherId: person.fatherId ?? '',
    firstName: person.firstName,
    gender: person.gender,
    lastName: person.lastName,
    motherId: person.motherId ?? '',
    photos: person.photos,
    profileImageUrl: person.profileImageUrl ?? '',
    profileVideoUrl: person.profileVideoUrl ?? '',
    spouseId: person.spouseId ?? inferredSpouseId ?? '',
  }
}

function getDraftKey(mode: PersonFormMode, id?: string) {
  return mode === 'add' ? 'draft_new' : `draft_edit_${id ?? 'unknown'}`
}

function getFieldClass(error?: string, shake?: boolean) {
  return `${FIELD_BASE_CLASS} ${
    error
      ? `border-red-400 focus:border-red-400 focus:ring-red-100 ${shake ? 'field-shake' : ''}`
      : 'border-warm-brown/10'
  }`
}

function getBirthYear(date: string) {
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? 'Tahun tidak diketahui' : String(parsed.getFullYear())
}

function useDesktopMode() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    const listener = (event: MediaQueryListEvent) => setIsDesktop(event.matches)

    setIsDesktop(mediaQuery.matches)
    mediaQuery.addEventListener('change', listener)

    return () => {
      mediaQuery.removeEventListener('change', listener)
    }
  }, [])

  return isDesktop
}

function SearchablePersonPicker({
  description,
  emptyLabel,
  error,
  label,
  onChange,
  options,
  selectedId,
  shake,
}: SearchablePersonPickerProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const selectedOption = options.find((option) => option.person.id === selectedId)
  const filteredOptions = useMemo(() => {
    const search = query.trim().toLowerCase()

    if (!search) {
      return options
    }

    return options.filter((option) => getFullName(option.person).toLowerCase().includes(search))
  }, [options, query])

  useEffect(() => {
    setQuery('')
  }, [selectedId])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    window.addEventListener('mousedown', handleClickOutside)
    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className="space-y-2" ref={wrapperRef}>
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-warm-brown/72">{label}</label>
        <span className="text-xs text-warm-brown/45">{description}</span>
      </div>
      <div className="relative">
        <button
          className={`${getFieldClass(error, shake)} flex min-h-[52px] items-center justify-between text-left`}
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <span className="flex min-w-0 items-center gap-3">
            {selectedOption ? (
              <>
                <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted-gold text-xs font-semibold text-cream">
                  {selectedOption.person.profileImageUrl ? (
                    <img
                      alt={getFullName(selectedOption.person)}
                      className="h-full w-full object-cover"
                      src={selectedOption.person.profileImageUrl}
                    />
                  ) : (
                    getInitials(selectedOption.person)
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-warm-brown">{getFullName(selectedOption.person)}</span>
                  <span className="block text-xs text-warm-brown/45">{selectedOption.subtitle}</span>
                </span>
              </>
            ) : (
              <span className="text-sm text-warm-brown/45">{emptyLabel}</span>
            )}
          </span>
          <svg className="h-4 w-4 shrink-0 text-warm-brown/55" fill="none" viewBox="0 0 24 24">
            <path d="M7 10L12 15L17 10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          </svg>
        </button>

        {isOpen ? (
          <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-[1.4rem] border border-warm-brown/10 bg-white shadow-[0_18px_48px_rgba(124,74,45,0.12)]">
            <div className="border-b border-warm-brown/10 p-3">
              <input
                className={`${FIELD_BASE_CLASS} border-warm-brown/10 px-3 py-2`}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Cari ${label.toLowerCase()}...`}
                type="search"
                value={query}
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              <button
                className="flex w-full items-center justify-between rounded-[1rem] px-3 py-3 text-left text-sm text-warm-brown/70 transition hover:bg-cream"
                onClick={() => {
                  onChange('')
                  setIsOpen(false)
                }}
                type="button"
              >
                <span>Kosongkan pilihan</span>
              </button>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <button
                    className="flex w-full items-center gap-3 rounded-[1rem] px-3 py-3 text-left transition hover:bg-cream"
                    key={option.person.id}
                    onClick={() => {
                      onChange(option.person.id)
                      setIsOpen(false)
                    }}
                    type="button"
                  >
                    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-soft-green/12 text-xs font-semibold text-soft-green">
                      {option.person.profileImageUrl ? (
                        <img
                          alt={getFullName(option.person)}
                          className="h-full w-full object-cover"
                          src={option.person.profileImageUrl}
                        />
                      ) : (
                        getInitials(option.person)
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-warm-brown">{getFullName(option.person)}</span>
                      <span className="block text-xs text-warm-brown/45">{option.subtitle}</span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-4 text-sm text-warm-brown/50">Tidak ada hasil yang cocok.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}

function MiniTreePreview({
  father,
  mother,
  personName,
}: {
  father: Person | null
  mother: Person | null
  personName: string
}) {
  const childLabel = personName.trim() || 'Anggota baru'

  function Node({
    fill,
    initials,
    name,
    x,
    y,
  }: {
    fill: string
    initials: string
    name: string
    x: number
    y: number
  }) {
    return (
      <g transform={`translate(${x} ${y})`}>
        <rect fill="#FFF8F0" height="74" rx="18" stroke="rgba(124,74,45,0.18)" width="86" />
        <circle cx="43" cy="22" fill={fill} r="14" />
        <text
          fill="#FFF8F0"
          fontFamily="Inter, sans-serif"
          fontSize="10"
          fontWeight="700"
          textAnchor="middle"
          x="43"
          y="26"
        >
          {initials}
        </text>
        <text
          fill="#7C4A2D"
          fontFamily="Lora, serif"
          fontSize="10"
          textAnchor="middle"
          x="43"
          y="48"
        >
          {name.length > 12 ? `${name.slice(0, 11)}...` : name}
        </text>
      </g>
    )
  }

  return (
    <div className="rounded-[1.6rem] border border-warm-brown/10 bg-cream/65 p-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-soft-green">Preview keluarga</p>
      <svg className="mt-4 h-auto w-full" viewBox="0 0 240 180">
        <path d="M77 84C77 102 100 116 120 116" fill="none" opacity="0.4" stroke="#7C4A2D" strokeWidth="1.5" />
        <path d="M163 84C163 102 140 116 120 116" fill="none" opacity="0.4" stroke="#7C4A2D" strokeWidth="1.5" />
        <line opacity="0.4" stroke="#7C4A2D" strokeWidth="1.5" x1="86" x2="154" y1="84" y2="84" />
        <Node
          fill="#5A7A4A"
          initials={father ? getInitials(father) : '?'}
          name={father ? getFullName(father) : 'Ayah'}
          x={20}
          y={10}
        />
        <Node
          fill="#C9943A"
          initials={mother ? getInitials(mother) : '?'}
          name={mother ? getFullName(mother) : 'Ibu'}
          x={134}
          y={10}
        />
        <Node
          fill="#7C4A2D"
          initials={childLabel
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0])
            .join('')
            .toUpperCase() || '?'}
          name={childLabel}
          x={77}
          y={106}
        />
      </svg>
    </div>
  )
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Tidak bisa membaca file.'))
    reader.readAsDataURL(file)
  })
}

async function getVideoDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')

    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const duration = video.duration
      URL.revokeObjectURL(url)
      resolve(duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Tidak bisa membaca durasi video.'))
    }
    video.src = url
  })
}

function UploadDropZone({
  accept,
  description,
  error,
  label,
  multiple = false,
  onFilesSelected,
  preview,
  shake,
}: {
  accept: string
  description: string
  error?: string
  label: string
  multiple?: boolean
  onFilesSelected: (files: FileList | File[]) => void
  preview?: ReactNode
  shake?: boolean
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-warm-brown/72">{label}</label>
        <span className="text-xs text-warm-brown/45">{description}</span>
      </div>
      <button
        className={`${getFieldClass(error, shake)} ${
          isDragging ? 'border-soft-green bg-soft-green/5' : ''
        } flex min-h-[11rem] flex-col items-center justify-center border-dashed text-center`}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setIsDragging(false)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          if (event.dataTransfer.files.length > 0) {
            onFilesSelected(event.dataTransfer.files)
          }
        }}
        type="button"
      >
        <svg className="h-8 w-8 text-soft-green" fill="none" viewBox="0 0 24 24">
          <path d="M12 16V6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M8.5 9.5L12 6L15.5 9.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M5 17.5C5 19.433 6.567 21 8.5 21H15.5C17.433 21 19 19.433 19 17.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
        <p className="mt-3 text-sm font-medium text-warm-brown">Tarik file ke sini atau ketuk untuk memilih</p>
        <p className="mt-1 text-xs text-warm-brown/50">{accept.replaceAll(',', ' / ')}</p>
      </button>
      <input
        accept={accept}
        className="hidden"
        multiple={multiple}
        onChange={(event) => {
          if (event.target.files) {
            onFilesSelected(event.target.files)
            event.target.value = ''
          }
        }}
        ref={inputRef}
        type="file"
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {preview ? <div>{preview}</div> : null}
    </div>
  )
}

function Toast({
  message,
  tone = 'success',
}: {
  message: string
  tone?: 'success' | 'warning'
}) {
  return (
    <div
      className={`app-toast fixed bottom-5 z-50 -translate-x-1/2 rounded-full px-5 py-3 text-sm font-medium shadow-[0_18px_38px_rgba(90,122,74,0.28)] ${
        tone === 'warning'
          ? 'app-toast-warning'
          : 'bg-soft-green text-cream'
      }`}
    >
      {message}
    </div>
  )
}

export default function PersonFormPage({ mode }: PersonFormPageProps) {
  const navigate = useNavigate()
  const { id } = useParams()
  const isDesktop = useDesktopMode()
  const { addPerson, getSpouse, persons, updatePerson } = useFamily()
  const existingPerson = persons.find((person) => person.id === id)
  const [activeStep, setActiveStep] = useState(1)
  const [form, setForm] = useState<PersonFormState>(() =>
    existingPerson ? fromPerson(existingPerson, getSpouse(existingPerson.id)?.id ?? null) : createEmptyState(),
  )
  const [showDeathDate, setShowDeathDate] = useState(Boolean(existingPerson?.deathDate))
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [shakingFields, setShakingFields] = useState<Partial<Record<FieldName, boolean>>>({})
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const draftKey = getDraftKey(mode, id)

  useEffect(() => {
    if (mode === 'edit' && !existingPerson) {
      return
    }

    const baseState = existingPerson
      ? fromPerson(existingPerson, getSpouse(existingPerson.id)?.id ?? null)
      : createEmptyState()

    try {
      const draftValue = window.localStorage.getItem(draftKey)
      if (draftValue) {
        const parsed = JSON.parse(draftValue) as Partial<DraftPayload>
        setForm(parsed.form ? { ...baseState, ...parsed.form } : baseState)
        setActiveStep(typeof parsed.activeStep === 'number' ? parsed.activeStep : 1)
        setShowDeathDate(Boolean(parsed.showDeathDate || baseState.deathDate))
        return
      }
    } catch {
      window.localStorage.removeItem(draftKey)
    }

    setForm(baseState)
    setActiveStep(1)
    setShowDeathDate(Boolean(baseState.deathDate))
  }, [draftKey, existingPerson, getSpouse, mode])

  useEffect(() => {
    if (mode === 'edit' && !existingPerson) {
      return
    }

    const payload: DraftPayload = {
      activeStep,
      form,
      showDeathDate,
    }

    try {
      window.localStorage.setItem(draftKey, JSON.stringify(payload))
    } catch {
      setWarningMessage('Draft terlalu besar untuk localStorage perangkat ini.')
    }
  }, [activeStep, draftKey, existingPerson, form, mode, showDeathDate])

  useEffect(() => {
    if (!statusMessage && !warningMessage) {
      return
    }

    const timeout = window.setTimeout(() => {
      setStatusMessage(null)
      setWarningMessage(null)
    }, 3000)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [statusMessage, warningMessage])

  const selectablePeople = useMemo(
    () => persons.filter((person) => person.id !== id),
    [id, persons],
  )

  const fatherOptions = useMemo(
    () =>
      selectablePeople
        .filter((person) => person.gender === 'male' || person.gender === 'unknown')
        .map((person) => ({
          person,
          subtitle: `Lahir ${getBirthYear(person.birthDate)}`,
        })),
    [selectablePeople],
  )

  const motherOptions = useMemo(
    () =>
      selectablePeople
        .filter((person) => person.gender === 'female' || person.gender === 'unknown')
        .map((person) => ({
          person,
          subtitle: `Lahir ${getBirthYear(person.birthDate)}`,
        })),
    [selectablePeople],
  )

  const spouseOptions = useMemo(
    () =>
      selectablePeople.map((person) => ({
        person,
        subtitle: `Lahir ${getBirthYear(person.birthDate)}`,
      })),
    [selectablePeople],
  )

  const selectedFather = persons.find((person) => person.id === form.fatherId) ?? null
  const selectedMother = persons.find((person) => person.id === form.motherId) ?? null

  function updateField<K extends keyof PersonFormState>(field: K, value: PersonFormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))

    if (errors[field as FieldName]) {
      setErrors((current) => ({
        ...current,
        [field]: undefined,
      }))
    }
  }

  function markFieldError(field: FieldName, message: string) {
    setErrors((current) => ({
      ...current,
      [field]: message,
    }))
    setShakingFields((current) => ({
      ...current,
      [field]: true,
    }))
    window.setTimeout(() => {
      setShakingFields((current) => ({
        ...current,
        [field]: false,
      }))
    }, 360)
  }

  function causesCircularParentage(candidateParentId: string) {
    if (!candidateParentId || !id) {
      return false
    }

    const byId = new Map(persons.map((person) => [person.id, person]))
    const visited = new Set<string>()
    const stack = [candidateParentId]

    while (stack.length > 0) {
      const currentId = stack.pop()
      if (!currentId || visited.has(currentId)) {
        continue
      }

      if (currentId === id) {
        return true
      }

      visited.add(currentId)
      const currentPerson = byId.get(currentId)
      if (!currentPerson) {
        continue
      }

      if (currentPerson.fatherId) {
        stack.push(currentPerson.fatherId)
      }

      if (currentPerson.motherId) {
        stack.push(currentPerson.motherId)
      }
    }

    return false
  }

  function validateStep(step: number) {
    const nextErrors: Partial<Record<FieldName, string>> = {}

    if (step === 1 || step === 99) {
      if (form.firstName.trim().length < 2) {
        nextErrors.firstName = 'Nama depan minimal 2 karakter.'
      }

      if (!form.lastName.trim()) {
        nextErrors.lastName = 'Nama belakang wajib diisi.'
      }

      if (!form.birthDate) {
        nextErrors.birthDate = 'Tanggal lahir wajib diisi.'
      }

      if (form.biography.length > 500) {
        nextErrors.biography = 'Biografi maksimal 500 karakter.'
      }
    }

    if (step === 2 || step === 99) {
      if (id && form.fatherId === id) {
        nextErrors.fatherId = 'Tidak bisa memilih diri sendiri sebagai ayah.'
      }

      if (id && form.motherId === id) {
        nextErrors.motherId = 'Tidak bisa memilih diri sendiri sebagai ibu.'
      }

      if (id && form.spouseId === id) {
        nextErrors.spouseId = 'Tidak bisa memilih diri sendiri sebagai pasangan.'
      }

      if (causesCircularParentage(form.fatherId)) {
        nextErrors.fatherId = 'Relasi ayah ini membuat silsilah menjadi melingkar.'
      }

      if (causesCircularParentage(form.motherId)) {
        nextErrors.motherId = 'Relasi ibu ini membuat silsilah menjadi melingkar.'
      }
    }

    if (step === 3 || step === 99) {
      if (form.profileImageUrl.length > 0 && form.profileImageUrl.length > 2_800_000) {
        nextErrors.profileImageUrl = 'Ukuran gambar terlalu besar untuk disimpan dengan aman.'
      }

      if (form.profileVideoUrl.length > 0 && form.profileVideoUrl.length > 14_000_000) {
        nextErrors.profileVideoUrl = 'Video terlalu besar untuk localStorage browser.'
      }
    }

    setErrors(nextErrors)
    for (const [field, message] of Object.entries(nextErrors)) {
      if (message) {
        markFieldError(field as FieldName, message)
      }
    }

    return {
      isValid: Object.keys(nextErrors).length === 0,
      nextErrors,
    }
  }

  async function handleImageUpload(files: FileList | File[], photoLabel?: PhotoLabel) {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) {
      return
    }

    const nextPhotos: PersonPhoto[] = []

    for (const file of fileArray) {
      if (!file.type.startsWith('image/')) {
        setWarningMessage('Hanya file gambar yang bisa diunggah di bagian ini.')
        continue
      }

      if (file.size > 2 * 1024 * 1024) {
        setWarningMessage('Ukuran gambar lebih dari 2MB. Penyimpanan browser bisa cepat penuh.')
      }

      const dataUrl = await readFileAsDataUrl(file)

      if (photoLabel) {
        nextPhotos.push({
          id: crypto.randomUUID(),
          label: photoLabel,
          url: dataUrl,
        })
      } else {
        updateField('profileImageUrl', dataUrl)
      }
    }

    if (photoLabel && nextPhotos.length > 0) {
      updateField('photos', [...form.photos, ...nextPhotos])
    }
  }

  async function handleVideoUpload(files: FileList | File[]) {
    const file = Array.from(files)[0]
    if (!file) {
      return
    }

    if (!['video/mp4', 'video/webm'].includes(file.type)) {
      markFieldError('profileVideoUrl', 'Gunakan video MP4 atau WebM.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      markFieldError('profileVideoUrl', 'Ukuran video maksimal 10MB.')
      return
    }

    const duration = await getVideoDuration(file)
    if (duration > 90) {
      setWarningMessage('Durasi video cukup panjang. Pastikan penyimpanan perangkat masih cukup.')
    }

    const dataUrl = await readFileAsDataUrl(file)
    updateField('profileVideoUrl', dataUrl)
  }

  function clearDraftAndGoBack() {
    window.localStorage.removeItem(draftKey)
    navigate(mode === 'edit' && id ? `/person/${id}` : '/')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validation = validateStep(99)

    if (!validation.isValid) {
      if (!isDesktop) {
        if (
          validation.nextErrors.firstName ||
          validation.nextErrors.lastName ||
          validation.nextErrors.birthDate ||
          validation.nextErrors.biography
        ) {
          setActiveStep(1)
        } else if (
          validation.nextErrors.fatherId ||
          validation.nextErrors.motherId ||
          validation.nextErrors.spouseId
        ) {
          setActiveStep(2)
        } else {
          setActiveStep(3)
        }
      }
      return
    }

    const draft = toDraft(form)
    setStatusMessage('Berhasil disimpan! ✓')
    window.localStorage.removeItem(draftKey)

    window.setTimeout(() => {
      if (mode === 'add') {
        const createdPerson = addPerson(draft)
        navigate(`/person/${createdPerson.id}`)
        return
      }

      if (id) {
        const updatedPerson = updatePerson(id, draft)
        if (updatedPerson) {
          navigate(`/person/${updatedPerson.id}`)
        }
      }
    }, 650)
  }

  const currentStep = STEP_LIST.find((step) => step.id === activeStep) ?? STEP_LIST[0]

  if (mode === 'edit' && !existingPerson) {
    return (
      <section className="mx-auto w-full max-w-5xl rounded-[2rem] border border-warm-brown/10 bg-white/70 p-6 shadow-[0_24px_60px_rgba(124,74,45,0.06)]">
        <p className="font-serif text-2xl text-warm-brown">Anggota tidak ditemukan.</p>
        <p className="mt-3 text-sm text-warm-brown/70">
          Data edit tidak tersedia di perangkat ini. Anda bisa kembali ke beranda dan memilih anggota lain.
        </p>
      </section>
    )
  }

  return (
    <>
      {statusMessage ? <Toast message={statusMessage} /> : null}
      {warningMessage ? <Toast message={warningMessage} tone="warning" /> : null}

      <section className="mx-auto w-full max-w-6xl space-y-6">
        <div className="overflow-hidden rounded-[2rem] border border-warm-brown/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(255,248,240,0.82),rgba(201,148,58,0.15))] p-6 shadow-[0_28px_70px_rgba(124,74,45,0.08)]">
          <p className="text-xs uppercase tracking-[0.3em] text-soft-green">
            {mode === 'add' ? 'Tambah anggota' : 'Edit anggota'}
          </p>
          <h1 className="mt-3 font-serif text-4xl text-warm-brown">
            {mode === 'add'
              ? 'Bangun cerita anggota keluarga selangkah demi selangkah.'
              : `Perbarui cerita ${existingPerson ? getFullName(existingPerson) : 'keluarga'}.`}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-warm-brown/70">
            Pada ponsel, formulir ini berjalan sebagai wizard 3 langkah. Di desktop, semua bagian tampil sekaligus agar lebih cepat ditinjau sebelum disimpan.
          </p>
        </div>

        {!isDesktop ? (
          <div className="grid grid-cols-3 gap-3">
            {STEP_LIST.map((step) => (
              <button
                className={`rounded-[1.4rem] border px-4 py-4 text-left transition ${
                  activeStep === step.id
                    ? 'border-soft-green bg-soft-green text-cream shadow-[0_18px_35px_rgba(90,122,74,0.18)]'
                    : 'border-warm-brown/10 bg-white/75 text-warm-brown hover:bg-cream'
                }`}
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                type="button"
              >
                <p className={`text-xs uppercase tracking-[0.22em] ${activeStep === step.id ? 'text-cream/75' : 'text-soft-green'}`}>
                  Step {step.id}
                </p>
                <p className="mt-2 font-serif text-lg">{step.title}</p>
              </button>
            ))}
          </div>
        ) : null}

        <form className="space-y-6" onSubmit={handleSubmit}>
          {!isDesktop ? (
            <div className="rounded-[1.7rem] border border-warm-brown/10 bg-white/75 p-5 shadow-[0_20px_50px_rgba(124,74,45,0.06)]">
              <p className="text-xs uppercase tracking-[0.26em] text-soft-green">Step {currentStep.id}</p>
              <h2 className="mt-2 font-serif text-3xl text-warm-brown">{currentStep.title}</h2>
              <p className="mt-2 text-sm text-warm-brown/68">{currentStep.description}</p>
            </div>
          ) : null}

          {(isDesktop || activeStep === 1) && (
            <section className="rounded-[2rem] border border-warm-brown/10 bg-white/72 p-6 shadow-[0_22px_60px_rgba(124,74,45,0.06)]">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.26em] text-soft-green">Step 1</p>
                  <h2 className="mt-2 font-serif text-3xl text-warm-brown">Identity</h2>
                </div>
                <p className="text-sm text-warm-brown/52">Biografi {form.biography.length}/500 karakter</p>
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-warm-brown/72">First name*</span>
                  <input
                    className={getFieldClass(errors.firstName, shakingFields.firstName)}
                    onChange={(event) => updateField('firstName', event.target.value)}
                    placeholder="Contoh: Nisa"
                    type="text"
                    value={form.firstName}
                  />
                  {errors.firstName ? <p className="text-sm text-red-600">{errors.firstName}</p> : null}
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-warm-brown/72">Last name*</span>
                  <input
                    className={getFieldClass(errors.lastName, shakingFields.lastName)}
                    onChange={(event) => updateField('lastName', event.target.value)}
                    placeholder="Contoh: Saputra"
                    type="text"
                    value={form.lastName}
                  />
                  {errors.lastName ? <p className="text-sm text-red-600">{errors.lastName}</p> : null}
                </label>

                <div className="space-y-3 lg:col-span-2">
                  <span className="text-sm font-medium text-warm-brown/72">Gender</span>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { label: 'Laki-laki', value: 'male' },
                      { label: 'Perempuan', value: 'female' },
                      { label: 'Lainnya', value: 'nonbinary' },
                    ].map((option) => (
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-[1.25rem] border px-4 py-3 transition ${
                          form.gender === option.value
                            ? 'border-soft-green bg-soft-green/10 text-soft-green'
                            : 'border-warm-brown/10 bg-cream/45 text-warm-brown/70 hover:bg-cream'
                        }`}
                        key={option.value}
                      >
                        <input
                          checked={form.gender === option.value}
                          className="h-4 w-4 accent-soft-green"
                          name="gender"
                          onChange={() => updateField('gender', option.value as Gender)}
                          type="radio"
                        />
                        <span className="text-sm">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-warm-brown/72">Birth date</span>
                  <input
                    className={getFieldClass(errors.birthDate, shakingFields.birthDate)}
                    onChange={(event) => updateField('birthDate', event.target.value)}
                    type="date"
                    value={form.birthDate}
                  />
                  {errors.birthDate ? <p className="text-sm text-red-600">{errors.birthDate}</p> : null}
                </label>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-[1.25rem] border border-warm-brown/10 bg-cream/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-warm-brown/72">Death date</p>
                      <p className="text-xs text-warm-brown/45">Tampilkan hanya bila diperlukan</p>
                    </div>
                    <button
                      className={`relative h-7 w-[3.25rem] rounded-full transition ${showDeathDate ? 'bg-soft-green' : 'bg-warm-brown/15'}`}
                      onClick={() => {
                        setShowDeathDate((current) => !current)
                        if (showDeathDate) {
                          updateField('deathDate', '')
                        }
                      }}
                      type="button"
                    >
                      <span
                        className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                          showDeathDate ? 'left-7' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                  {showDeathDate ? (
                    <input
                      className={getFieldClass(errors.deathDate, shakingFields.deathDate)}
                      onChange={(event) => updateField('deathDate', event.target.value)}
                      type="date"
                      value={form.deathDate}
                    />
                  ) : null}
                </div>

                <label className="space-y-2 lg:col-span-2">
                  <span className="text-sm font-medium text-warm-brown/72">Biography</span>
                  <textarea
                    className={`${getFieldClass(errors.biography, shakingFields.biography)} min-h-40 resize-y`}
                    maxLength={500}
                    onChange={(event) => updateField('biography', event.target.value)}
                    placeholder="Tuliskan kenangan, sifat, atau cerita penting yang ingin diwariskan."
                    value={form.biography}
                  />
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-warm-brown/45">Maksimal 500 karakter.</span>
                    <span className={form.biography.length > 450 ? 'text-muted-gold' : 'text-warm-brown/45'}>
                      {form.biography.length}/500
                    </span>
                  </div>
                  {errors.biography ? <p className="text-sm text-red-600">{errors.biography}</p> : null}
                </label>
              </div>
            </section>
          )}

          {(isDesktop || activeStep === 2) && (
            <section className="rounded-[2rem] border border-warm-brown/10 bg-white/72 p-6 shadow-[0_22px_60px_rgba(124,74,45,0.06)]">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-soft-green">Step 2</p>
                <h2 className="mt-2 font-serif text-3xl text-warm-brown">Family links</h2>
              </div>

              <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="space-y-5">
                  <SearchablePersonPicker
                    description="Male / Unknown"
                    emptyLabel="Pilih ayah"
                    error={errors.fatherId}
                    label="Father picker"
                    onChange={(personId) => updateField('fatherId', personId)}
                    options={fatherOptions}
                    selectedId={form.fatherId}
                    shake={Boolean(shakingFields.fatherId)}
                  />

                  <SearchablePersonPicker
                    description="Female / Unknown"
                    emptyLabel="Pilih ibu"
                    error={errors.motherId}
                    label="Mother picker"
                    onChange={(personId) => updateField('motherId', personId)}
                    options={motherOptions}
                    selectedId={form.motherId}
                    shake={Boolean(shakingFields.motherId)}
                  />

                  <SearchablePersonPicker
                    description="Opsional"
                    emptyLabel="Pilih pasangan"
                    error={errors.spouseId}
                    label="Spouse picker"
                    onChange={(personId) => updateField('spouseId', personId)}
                    options={spouseOptions}
                    selectedId={form.spouseId}
                    shake={Boolean(shakingFields.spouseId)}
                  />
                </div>

                <MiniTreePreview
                  father={selectedFather}
                  mother={selectedMother}
                  personName={`${form.firstName} ${form.lastName}`.trim()}
                />
              </div>
            </section>
          )}

          {(isDesktop || activeStep === 3) && (
            <section className="rounded-[2rem] border border-warm-brown/10 bg-white/72 p-6 shadow-[0_22px_60px_rgba(124,74,45,0.06)]">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-soft-green">Step 3</p>
                <h2 className="mt-2 font-serif text-3xl text-warm-brown">Photos & video</h2>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                <UploadDropZone
                  accept="image/*"
                  description="Base64 / peringatan > 2MB"
                  error={errors.profileImageUrl}
                  label="Profile image upload"
                  onFilesSelected={(files) => {
                    void handleImageUpload(files)
                  }}
                  preview={
                    form.profileImageUrl ? (
                      <div className="overflow-hidden rounded-[1.2rem] border border-warm-brown/10">
                        <img alt="Preview foto profil" className="aspect-[4/3] w-full object-cover" src={form.profileImageUrl} />
                      </div>
                    ) : null
                  }
                  shake={Boolean(shakingFields.profileImageUrl)}
                />

                <UploadDropZone
                  accept="video/mp4,video/webm"
                  description="MP4 / WebM / maks 10MB"
                  error={errors.profileVideoUrl}
                  label="Profile video upload"
                  onFilesSelected={(files) => {
                    void handleVideoUpload(files)
                  }}
                  preview={
                    form.profileVideoUrl ? (
                      <video className="aspect-[4/3] w-full rounded-[1.2rem] border border-warm-brown/10 object-cover" controls src={form.profileVideoUrl} />
                    ) : null
                  }
                  shake={Boolean(shakingFields.profileVideoUrl)}
                />
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-3">
                {PHOTO_LABELS.map((photoGroup) => {
                  const groupPhotos = form.photos.filter((photo) => photo.label === photoGroup.value)

                  return (
                    <div className="space-y-3" key={photoGroup.value}>
                      <UploadDropZone
                        accept="image/*"
                        description="Bisa lebih dari satu"
                        label={photoGroup.label}
                        multiple
                        onFilesSelected={(files) => {
                          void handleImageUpload(files, photoGroup.value)
                        }}
                        preview={
                          groupPhotos.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2">
                              {groupPhotos.map((photo) => (
                                <div className="group relative overflow-hidden rounded-[1rem] border border-warm-brown/10" key={photo.id}>
                                  <img alt="" className="aspect-square w-full object-cover" src={photo.url} />
                                  <button
                                    className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/85 text-warm-brown opacity-0 transition group-hover:opacity-100"
                                    onClick={() =>
                                      updateField(
                                        'photos',
                                        form.photos.filter((entry) => entry.id !== photo.id),
                                      )
                                    }
                                    type="button"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                                      <path d="M6 6L18 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
                                      <path d="M18 6L6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : null
                        }
                      />
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[1.6rem] border border-warm-brown/10 bg-white/88 px-4 py-4 shadow-[0_18px_44px_rgba(124,74,45,0.12)] backdrop-blur">
            <button
              className="rounded-full border border-warm-brown/15 px-5 py-3 text-sm text-warm-brown transition hover:bg-cream"
              onClick={clearDraftAndGoBack}
              type="button"
            >
              Batal
            </button>

            <div className="flex items-center gap-3">
              {!isDesktop && activeStep > 1 ? (
                <button
                  className="rounded-full border border-warm-brown/15 px-5 py-3 text-sm text-warm-brown transition hover:bg-cream"
                  onClick={() => setActiveStep((current) => Math.max(current - 1, 1))}
                  type="button"
                >
                  Kembali
                </button>
              ) : null}

              {!isDesktop && activeStep < 3 ? (
                <button
                  className="rounded-full bg-soft-green px-5 py-3 text-sm text-cream transition hover:bg-warm-brown"
                  onClick={() => {
                    if (validateStep(activeStep).isValid) {
                      setActiveStep((current) => Math.min(current + 1, 3))
                    }
                  }}
                  type="button"
                >
                  Lanjut
                </button>
              ) : (
                <button
                  className="rounded-full bg-muted-gold px-6 py-3 text-sm text-cream shadow-[0_18px_38px_rgba(201,148,58,0.28)] transition hover:bg-warm-brown"
                  type="submit"
                >
                  Simpan
                </button>
              )}
            </div>
          </div>
        </form>
      </section>
    </>
  )
}
