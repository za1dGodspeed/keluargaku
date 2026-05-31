import type { Person, PersonDraft, PersonPhoto } from '../types/family'

export const FAMILY_STORAGE_KEY = 'keluargaku.family.v1'

const placeholderPhoto = (name: string, label: PersonPhoto['label']): PersonPhoto => ({
  id: crypto.randomUUID(),
  label,
  url: `https://placehold.co/800x520/FFF8F0/7C4A2D?text=${encodeURIComponent(name)}`,
})

export function createSeedFamily(): Person[] {
  const createdAt = new Date('2026-01-01T08:00:00.000Z').toISOString()
  const updatedAt = createdAt
  const budiId = 'seed-budi'
  const sariId = 'seed-sari'
  const andiId = 'seed-andi'
  const mayaId = 'seed-maya'
  const nisaId = 'seed-nisa'
  const rafiId = 'seed-rafi'

  return [
    {
      id: budiId,
      firstName: 'Budi',
      lastName: 'Saputra',
      birthDate: '1954-02-15',
      deathDate: null,
      gender: 'male',
      fatherId: null,
      motherId: null,
      spouseId: sariId,
      profileImageUrl: null,
      profileVideoUrl: null,
      biography:
        'Budi adalah penenun cerita keluarga yang selalu mengumpulkan semua orang saat panen rambutan dan libur Lebaran.',
      photos: [placeholderPhoto('Budi Saputra', 'now')],
      createdAt,
      updatedAt,
    },
    {
      id: sariId,
      firstName: 'Sari',
      lastName: 'Saputra',
      birthDate: '1957-09-03',
      deathDate: null,
      gender: 'female',
      fatherId: null,
      motherId: null,
      spouseId: budiId,
      profileImageUrl: null,
      profileVideoUrl: null,
      biography:
        'Sari menjaga buku resep keluarga dan menuliskan asal-usul tiap hidangan agar kisahnya tidak hilang.',
      photos: [placeholderPhoto('Sari Saputra', 'now')],
      createdAt,
      updatedAt,
    },
    {
      id: andiId,
      firstName: 'Andi',
      lastName: 'Saputra',
      birthDate: '1982-06-20',
      deathDate: null,
      gender: 'male',
      fatherId: budiId,
      motherId: sariId,
      spouseId: mayaId,
      profileImageUrl: null,
      profileVideoUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      biography:
        'Andi senang mendokumentasikan perjalanan keluarga, dari ulang tahun sederhana sampai reuni lintas kota.',
      photos: [placeholderPhoto('Andi Bayi', 'baby'), placeholderPhoto('Andi Kini', 'now')],
      createdAt,
      updatedAt,
    },
    {
      id: mayaId,
      firstName: 'Maya',
      lastName: 'Prameswari',
      birthDate: '1985-11-14',
      deathDate: null,
      gender: 'female',
      fatherId: null,
      motherId: null,
      spouseId: andiId,
      profileImageUrl: null,
      profileVideoUrl: null,
      biography:
        'Maya mengarsipkan foto-foto lama keluarga dan sering menambahkan catatan kecil tentang momen di baliknya.',
      photos: [placeholderPhoto('Maya Prameswari', 'now')],
      createdAt,
      updatedAt,
    },
    {
      id: nisaId,
      firstName: 'Nisa',
      lastName: 'Saputra',
      birthDate: '2010-04-28',
      deathDate: null,
      gender: 'female',
      fatherId: andiId,
      motherId: mayaId,
      spouseId: null,
      profileImageUrl: null,
      profileVideoUrl: null,
      biography:
        'Nisa menyimpan jurnal keluarga digital, berisi foto, suara, dan kenangan kecil yang ingin ia wariskan.',
      photos: [placeholderPhoto('Nisa Anak', 'kids'), placeholderPhoto('Nisa Kini', 'now')],
      createdAt,
      updatedAt,
    },
    {
      id: rafiId,
      firstName: 'Rafi',
      lastName: 'Saputra',
      birthDate: '2014-12-11',
      deathDate: null,
      gender: 'male',
      fatherId: andiId,
      motherId: mayaId,
      spouseId: null,
      profileImageUrl: null,
      profileVideoUrl: null,
      biography:
        'Rafi selalu bertanya siapa di foto lama, sehingga keluarga mulai menambahkan nama pada setiap album dan dokumen.',
      photos: [placeholderPhoto('Rafi Kecil', 'kids')],
      createdAt,
      updatedAt,
    },
  ]
}

export function loadFamily(): Person[] {
  if (typeof window === 'undefined') {
    return createSeedFamily()
  }

  const raw = window.localStorage.getItem(FAMILY_STORAGE_KEY)

  if (!raw) {
    const seed = createSeedFamily()
    window.localStorage.setItem(FAMILY_STORAGE_KEY, JSON.stringify(seed))
    return seed
  }

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => ({
        ...entry,
        spouseId: entry.spouseId ?? null,
      }))
    }
  } catch {
    const seed = createSeedFamily()
    window.localStorage.setItem(FAMILY_STORAGE_KEY, JSON.stringify(seed))
    return seed
  }

  return createSeedFamily()
}

export function saveFamily(persons: Person[]) {
  window.localStorage.setItem(FAMILY_STORAGE_KEY, JSON.stringify(persons))
}

export function normalizeDraft(draft: PersonDraft): PersonDraft {
  return {
    ...draft,
    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    birthDate: draft.birthDate.trim(),
    deathDate: draft.deathDate?.trim() ? draft.deathDate : null,
    fatherId: draft.fatherId || null,
    motherId: draft.motherId || null,
    spouseId: draft.spouseId || null,
    profileImageUrl: draft.profileImageUrl?.trim() ? draft.profileImageUrl : null,
    profileVideoUrl: draft.profileVideoUrl?.trim() ? draft.profileVideoUrl : null,
    biography: draft.biography.trim(),
    photos: draft.photos
      .map((photo) => ({ ...photo, url: photo.url.trim() }))
      .filter((photo) => photo.url.length > 0),
  }
}

export function getFullName(person: Pick<Person, 'firstName' | 'lastName'>) {
  return `${person.firstName} ${person.lastName}`.trim()
}

export function getInitials(person: Pick<Person, 'firstName' | 'lastName'>) {
  return `${person.firstName.charAt(0)}${person.lastName.charAt(0) || ''}`.toUpperCase()
}

export function formatDateLabel(date: string | null) {
  if (!date) {
    return 'Sekarang'
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatLifeSpan(person: Pick<Person, 'birthDate' | 'deathDate'>) {
  return `${formatDateLabel(person.birthDate)} - ${formatDateLabel(person.deathDate)}`
}
