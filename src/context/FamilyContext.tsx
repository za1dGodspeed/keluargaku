import { createContext, useContext, useEffect, useState } from 'react'
import { loadFamily, normalizeDraft, saveFamily } from '../lib/familyData'
import type { Person, PersonDraft } from '../types/family'

interface FamilyContextValue {
  persons: Person[]
  addPerson: (draft: PersonDraft) => Person
  updatePerson: (id: string, draft: PersonDraft) => Person | null
  deletePerson: (id: string) => void
  getParents: (id: string) => Person[]
  getChildren: (id: string) => Person[]
  getSpouse: (id: string) => Person | null
}

const FamilyContext = createContext<FamilyContextValue | null>(null)

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const [persons, setPersons] = useState<Person[]>(() => loadFamily())

  useEffect(() => {
    saveFamily(persons)
  }, [persons])

  function syncSpouseLinks(personList: Person[], personId: string, nextSpouseId: string | null) {
    const nextList = personList.map((person) => {
      if (person.id === personId) {
        return {
          ...person,
          spouseId: nextSpouseId,
        }
      }

      if (nextSpouseId && person.id === nextSpouseId) {
        return {
          ...person,
          spouseId: personId,
        }
      }

      if (person.spouseId === personId || (nextSpouseId && person.spouseId === nextSpouseId)) {
        return {
          ...person,
          spouseId:
            person.id === nextSpouseId
              ? personId
              : person.spouseId === personId
                ? null
                : null,
        }
      }

      return person
    })

    return nextList
  }

  function addPerson(draft: PersonDraft) {
    const normalized = normalizeDraft(draft)
    const now = new Date().toISOString()
    const personId = crypto.randomUUID()
    const person: Person = {
      ...normalized,
      id: personId,
      createdAt: now,
      updatedAt: now,
    }

    setPersons((current) => syncSpouseLinks([...current, person], personId, normalized.spouseId))
    return person
  }

  function updatePerson(id: string, draft: PersonDraft) {
    const normalized = normalizeDraft(draft)
    const now = new Date().toISOString()
    let updatedPerson: Person | null = null

    setPersons((current) =>
      syncSpouseLinks(
        current.map((person) => {
          if (person.id !== id) {
            return person
          }

          updatedPerson = {
            ...person,
            ...normalized,
            updatedAt: now,
          }

          return updatedPerson
        }),
        id,
        normalized.spouseId,
      ),
    )

    return updatedPerson
  }

  function deletePerson(id: string) {
    const now = new Date().toISOString()

    setPersons((current) =>
      current
        .filter((person) => person.id !== id)
        .map((person) => {
          const parentRemoved = person.fatherId === id || person.motherId === id

          if (!parentRemoved) {
            return person
          }

          return {
            ...person,
            fatherId: person.fatherId === id ? null : person.fatherId,
            motherId: person.motherId === id ? null : person.motherId,
            spouseId: person.spouseId === id ? null : person.spouseId,
            updatedAt: now,
          }
        }),
    )
  }

  function getParents(id: string) {
    const person = persons.find((entry) => entry.id === id)
    if (!person) {
      return []
    }

    return persons.filter(
      (entry) => entry.id === person.fatherId || entry.id === person.motherId,
    )
  }

  function getChildren(id: string) {
    return persons.filter((entry) => entry.fatherId === id || entry.motherId === id)
  }

  function getSpouse(id: string) {
    const person = persons.find((entry) => entry.id === id)
    if (person?.spouseId) {
      return persons.find((entry) => entry.id === person.spouseId) ?? null
    }

    for (const child of persons) {
      if (child.fatherId === id && child.motherId) {
        return persons.find((entry) => entry.id === child.motherId) ?? null
      }

      if (child.motherId === id && child.fatherId) {
        return persons.find((entry) => entry.id === child.fatherId) ?? null
      }
    }

    return null
  }

  return (
    <FamilyContext.Provider
      value={{
        persons,
        addPerson,
        updatePerson,
        deletePerson,
        getParents,
        getChildren,
        getSpouse,
      }}
    >
      {children}
    </FamilyContext.Provider>
  )
}

export function useFamily() {
  const value = useContext(FamilyContext)

  if (!value) {
    throw new Error('useFamily must be used inside FamilyProvider')
  }

  return value
}
