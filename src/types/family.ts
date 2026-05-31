export type Gender = 'female' | 'male' | 'nonbinary' | 'unknown'
export type PhotoLabel = 'baby' | 'kids' | 'now'

export interface PersonPhoto {
  id: string
  url: string
  label: PhotoLabel
}

export interface Person {
  id: string
  firstName: string
  lastName: string
  birthDate: string
  deathDate: string | null
  gender: Gender
  fatherId: string | null
  motherId: string | null
  spouseId: string | null
  profileImageUrl: string | null
  profileVideoUrl: string | null
  biography: string
  photos: PersonPhoto[]
  createdAt: string
  updatedAt: string
}

export interface PersonDraft {
  firstName: string
  lastName: string
  birthDate: string
  deathDate: string | null
  gender: Gender
  fatherId: string | null
  motherId: string | null
  spouseId: string | null
  profileImageUrl: string | null
  profileVideoUrl: string | null
  biography: string
  photos: PersonPhoto[]
}
