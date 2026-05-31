import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildChildrenMap,
  buildCouples,
  computeGenerations,
  computeTreeLayout,
  makeConnectorPath,
  type TreeNodeSize,
} from '../components/FamilyTreeCanvas'
import { useFamily } from '../context/FamilyContext'
import { formatDateLabel, getFullName, getInitials } from '../lib/familyData'
import type { Person } from '../types/family'

declare global {
  interface Window {
    XLSX?: XlsxGlobal
    html2canvas?: Html2CanvasGlobal
  }
}

type XlsxGlobal = {
  utils: {
    aoa_to_sheet: (rows: Array<Array<string | number>>) => unknown
    book_append_sheet: (workbook: unknown, worksheet: unknown, name: string) => void
    book_new: () => unknown
  }
  write: (workbook: unknown, options: { bookType: string; type: string }) => ArrayBuffer
}

type Html2CanvasGlobal = (
  element: HTMLElement,
  options?: {
    backgroundColor?: string
    logging?: boolean
    scale?: number
    useCORS?: boolean
    windowHeight?: number
    windowWidth?: number
  },
) => Promise<HTMLCanvasElement>

declare global {
  interface Window {
    XLSX?: XlsxGlobal
    html2canvas?: Html2CanvasGlobal
  }
}

const HTML2CANVAS_SRC = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js'
const XLSX_SRC = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'

type ExportFormat = 'csv' | 'gedcom' | 'png' | 'xlsx'

interface ExportFileState {
  blob: Blob
  name: string
  type: ExportFormat
  url: string
}

interface ExportProgressState {
  format: ExportFormat | null
  label: string
  progress: number
}

interface TreeSelectionProps {
  layoutPersons: Person[]
  onToggle: (personId: string) => void
  selectedIds: Set<string>
}

interface ExportCardProps {
  action: () => void
  description: string
  disabled?: boolean
  estimate: string
  icon: ReactNode
  isActive: boolean
  isComplete: boolean
  label: string
  progress: number
}

const compactTreeNodeSize: TreeNodeSize = {
  width: 82,
  height: 62,
  avatar: 22,
  birthFontSize: 8,
  birthY: 0,
  nameCharsPerLine: 10,
  nameFontSize: 10,
  nameLineHeight: 11,
  nameY: 36,
  padding: 7,
}

function clampText(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, Math.max(maxLength - 3, 1)).trimEnd()}...` : text
}

function formatFileDate() {
  return new Date().toISOString().slice(0, 10)
}

function triggerDownload(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  return url
}

async function loadScript<T extends 'html2canvas' | 'XLSX'>(
  globalName: T,
  src: string,
): Promise<T extends 'html2canvas' ? Html2CanvasGlobal : XlsxGlobal> {
  if (window[globalName]) {
    return window[globalName] as T extends 'html2canvas' ? Html2CanvasGlobal : XlsxGlobal
  }

  const existing = document.querySelector<HTMLScriptElement>(`script[data-lib="${globalName}"]`)
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(`Gagal memuat ${globalName}.`)), {
        once: true,
      })
    })
    return window[globalName] as T extends 'html2canvas' ? Html2CanvasGlobal : XlsxGlobal
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.async = true
    script.dataset.lib = globalName
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Gagal memuat ${globalName} dari CDN.`))
    document.body.append(script)
  })

  return window[globalName] as T extends 'html2canvas' ? Html2CanvasGlobal : XlsxGlobal
}

function getAncestors(personId: string, personById: Map<string, Person>) {
  const ancestors = new Set<string>()
  const stack = [personId]

  while (stack.length > 0) {
    const currentId = stack.pop()
    if (!currentId) {
      continue
    }

    const person = personById.get(currentId)
    if (!person) {
      continue
    }

    for (const parentId of [person.fatherId, person.motherId]) {
      if (parentId && !ancestors.has(parentId)) {
        ancestors.add(parentId)
        stack.push(parentId)
      }
    }
  }

  return ancestors
}

function getDescendants(personId: string, childrenByParent: Map<string, Person[]>) {
  const descendants = new Set<string>()
  const stack = [personId]

  while (stack.length > 0) {
    const currentId = stack.pop()
    if (!currentId) {
      continue
    }

    for (const child of childrenByParent.get(currentId) ?? []) {
      if (!descendants.has(child.id)) {
        descendants.add(child.id)
        stack.push(child.id)
      }
    }
  }

  return descendants
}

function createFlatExportRows(persons: Person[], allPersons: Person[]) {
  const personById = new Map(allPersons.map((person) => [person.id, person]))
  const selectedById = new Map(persons.map((person) => [person.id, person]))
  const generationById = computeGenerations(allPersons, personById, buildCouples(allPersons))

  return persons
    .slice()
    .sort((left, right) => {
      const generationComparison =
        (generationById.get(left.id) ?? 0) - (generationById.get(right.id) ?? 0)

      if (generationComparison !== 0) {
        return generationComparison
      }

      const birthComparison = left.birthDate.localeCompare(right.birthDate)
      if (birthComparison !== 0) {
        return birthComparison
      }

      return getFullName(left).localeCompare(getFullName(right))
    })
    .map((person, index) => ({
      biography: clampText(person.biography || '', 200),
      deathDate: person.deathDate ? formatDateLabel(person.deathDate) : '',
      fatherName: person.fatherId
        ? getFullName(personById.get(person.fatherId) ?? { firstName: '', lastName: '' })
        : '',
      fullName: getFullName(person),
      gender:
        person.gender === 'male'
          ? 'Laki-laki'
          : person.gender === 'female'
            ? 'Perempuan'
            : person.gender === 'nonbinary'
              ? 'Lainnya'
              : 'Tidak diketahui',
      generation: (generationById.get(person.id) ?? 0) + 1,
      index: index + 1,
      motherName: person.motherId
        ? getFullName(personById.get(person.motherId) ?? { firstName: '', lastName: '' })
        : '',
      person: selectedById.get(person.id) ?? person,
      birthDate: formatDateLabel(person.birthDate),
    }))
}

function formatGedcomDate(date: string) {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${parsed.getUTCDate()} ${months[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`
}

function TreeSelectionSvg({ layoutPersons, onToggle, selectedIds }: TreeSelectionProps) {
  const layout = useMemo(() => computeTreeLayout(layoutPersons, compactTreeNodeSize), [layoutPersons])

  return (
    <div className="max-h-[32rem] overflow-auto rounded-[1.8rem] border border-warm-brown/10 bg-white/75 p-4">
      <svg
        className="block h-auto min-w-full"
        height={layout.bounds.height}
        viewBox={`0 0 ${layout.bounds.width} ${layout.bounds.height}`}
        width={layout.bounds.width}
      >
        {layout.edges.map((edge) => (
          <path
            d={makeConnectorPath(edge)}
            fill="none"
            key={edge.key}
            opacity={0.22}
            stroke="#7C4A2D"
            strokeWidth={1.2}
          />
        ))}

        {layout.marriages.map((marriage) => (
          <line
            key={marriage.key}
            opacity={0.3}
            stroke="#7C4A2D"
            strokeLinecap="round"
            strokeWidth={1.2}
            x1={marriage.sourceX}
            x2={marriage.targetX}
            y1={marriage.sourceY}
            y2={marriage.targetY}
          />
        ))}

        {layout.nodes.map((node) => {
          const isSelected = selectedIds.has(node.person.id)
          return (
            <g
              className="cursor-pointer"
              key={node.person.id}
              onClick={() => onToggle(node.person.id)}
              transform={`translate(${node.x} ${node.y})`}
            >
              <rect
                fill={isSelected ? '#F3F7F1' : '#FFF8F0'}
                height={node.height}
                rx={18}
                stroke={isSelected ? '#5A7A4A' : 'rgba(124,74,45,0.18)'}
                strokeWidth={isSelected ? 1.8 : 1}
                width={node.width}
              />
              <rect
                fill={isSelected ? '#5A7A4A' : '#FFFFFF'}
                height="15"
                rx="4"
                stroke={isSelected ? '#5A7A4A' : 'rgba(124,74,45,0.3)'}
                strokeWidth="1.2"
                width="15"
                x="8"
                y="8"
              />
              {isSelected ? (
                <path
                  d="M12 16L15 19L20 12.5"
                  fill="none"
                  stroke="#FFF8F0"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              ) : null}
              <circle cx={node.width / 2} cy={19} fill="#C9943A" r={10} />
              <text
                fill="#FFF8F0"
                fontFamily="Inter, sans-serif"
                fontSize="8"
                fontWeight="700"
                textAnchor="middle"
                x={node.width / 2}
                y="22"
              >
                {getInitials(node.person)}
              </text>
              <text
                fill="#7C4A2D"
                fontFamily="Lora, serif"
                fontSize="9.5"
                textAnchor="middle"
                x={node.width / 2}
                y="38"
              >
                {clampText(getFullName(node.person), 14)}
              </text>
              <text
                fill="rgba(124,74,45,0.55)"
                fontFamily="Inter, sans-serif"
                fontSize="7.5"
                textAnchor="middle"
                x={node.width / 2}
                y="50"
              >
                {formatDateLabel(node.person.birthDate).slice(-4)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function ExportPreviewTree({
  persons,
  scrollable = true,
}: {
  persons: Person[]
  scrollable?: boolean
}) {
  const previewNodeSize: TreeNodeSize = {
    avatar: 24,
    birthFontSize: 8,
    birthY: 52,
    height: 66,
    nameCharsPerLine: 11,
    nameFontSize: 10,
    nameLineHeight: 11,
    nameY: 39,
    padding: 7,
    width: 86,
  }
  const layout = useMemo(() => computeTreeLayout(persons, previewNodeSize), [persons])

  return (
    <div
      className={`rounded-[1.8rem] border border-warm-brown/10 bg-cream/70 p-4 ${
        scrollable ? 'overflow-auto' : 'overflow-visible'
      }`}
      style={scrollable ? undefined : { width: `${layout.bounds.width + 32}px` }}
    >
      <svg
        className="block h-auto min-w-full"
        height={layout.bounds.height}
        viewBox={`0 0 ${layout.bounds.width} ${layout.bounds.height}`}
        width={layout.bounds.width}
      >
        {layout.edges.map((edge) => (
          <path
            d={makeConnectorPath(edge)}
            fill="none"
            key={edge.key}
            opacity={0.28}
            stroke="#7C4A2D"
            strokeWidth={1.3}
          />
        ))}
        {layout.marriages.map((marriage) => (
          <line
            key={marriage.key}
            opacity={0.34}
            stroke="#7C4A2D"
            strokeLinecap="round"
            strokeWidth={1.3}
            x1={marriage.sourceX}
            x2={marriage.targetX}
            y1={marriage.sourceY}
            y2={marriage.targetY}
          />
        ))}
        {layout.nodes.map((node) => (
          <g key={node.person.id} transform={`translate(${node.x} ${node.y})`}>
            <rect fill="#FFF8F0" height={node.height} rx={18} stroke="rgba(124,74,45,0.18)" width={node.width} />
            <circle cx={node.width / 2} cy={19} fill="#5A7A4A" r={12} />
            <text
              fill="#FFF8F0"
              fontFamily="Inter, sans-serif"
              fontSize="8"
              fontWeight="700"
              textAnchor="middle"
              x={node.width / 2}
              y="22"
            >
              {getInitials(node.person)}
            </text>
            <text
              fill="#7C4A2D"
              fontFamily="Lora, serif"
              fontSize="10"
              textAnchor="middle"
              x={node.width / 2}
              y="40"
            >
              {clampText(getFullName(node.person), 13)}
            </text>
            <text
              fill="rgba(124,74,45,0.55)"
              fontFamily="Inter, sans-serif"
              fontSize="8"
              textAnchor="middle"
              x={node.width / 2}
              y="53"
            >
              {formatDateLabel(node.person.birthDate).slice(-4)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function ExportCard({
  action,
  description,
  disabled = false,
  estimate,
  icon,
  isActive,
  isComplete,
  label,
  progress,
}: ExportCardProps) {
  return (
    <article className="rounded-[1.8rem] border border-warm-brown/10 bg-white/76 p-5 shadow-[0_18px_48px_rgba(124,74,45,0.06)]">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-soft-green/10 text-soft-green">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-2xl text-warm-brown">{label}</h3>
          <p className="mt-2 text-sm leading-7 text-warm-brown/68">{description}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.22em] text-warm-brown/45">
            Estimasi ukuran: {estimate}
          </p>
        </div>
      </div>

      {isActive ? (
        <div className="mt-5">
          <div className="h-2 overflow-hidden rounded-full bg-cream">
            <div
              className="h-full rounded-full bg-soft-green transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-soft-green">Sedang membuat file... {progress}%</p>
        </div>
      ) : isComplete ? (
        <div className="mt-5 rounded-[1.2rem] bg-soft-green/10 px-4 py-3 text-sm text-soft-green">
          File berhasil dibuat.
        </div>
      ) : null}

      <button
        className={`mt-5 rounded-full px-5 py-3 text-sm text-cream shadow-[0_16px_35px_rgba(201,148,58,0.28)] transition ${
          disabled ? 'cursor-not-allowed bg-muted-gold/50' : 'bg-muted-gold hover:bg-warm-brown'
        }`}
        disabled={disabled}
        onClick={action}
        type="button"
      >
        Ekspor
      </button>
    </article>
  )
}

export default function ExportPage() {
  const { persons } = useFamily()
  const previewRef = useRef<HTMLDivElement | null>(null)
  const [exportMode, setExportMode] = useState<'all' | 'family'>('all')
  const [includeAncestors, setIncludeAncestors] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pngScale, setPngScale] = useState<1 | 2>(1)
  const [progress, setProgress] = useState<ExportProgressState>({
    format: null,
    label: '',
    progress: 0,
  })
  const [lastExport, setLastExport] = useState<ExportFileState | null>(null)
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const personById = useMemo(() => new Map(persons.map((person) => [person.id, person])), [persons])
  const childrenByParent = useMemo(() => buildChildrenMap(persons), [persons])

  useEffect(() => {
    return () => {
      if (lastExport) {
        URL.revokeObjectURL(lastExport.url)
      }
    }
  }, [lastExport])

  useEffect(() => {
    if (!shareMessage) {
      return
    }

    const timeout = window.setTimeout(() => setShareMessage(null), 3000)
    return () => window.clearTimeout(timeout)
  }, [shareMessage])

  const effectiveSelectedIds = useMemo(() => {
    if (exportMode === 'all') {
      return new Set(persons.map((person) => person.id))
    }

    return selectedIds
  }, [exportMode, persons, selectedIds])

  const selectedPersons = useMemo(
    () => persons.filter((person) => effectiveSelectedIds.has(person.id)),
    [effectiveSelectedIds, persons],
  )

  const flatRows = useMemo(() => createFlatExportRows(selectedPersons, persons), [persons, selectedPersons])
  const generationGroups = useMemo(() => {
    const groups = new Map<number, typeof flatRows>()
    for (const row of flatRows) {
      const current = groups.get(row.generation)
      if (current) {
        current.push(row)
      } else {
        groups.set(row.generation, [row])
      }
    }
    return Array.from(groups.entries()).sort((left, right) => left[0] - right[0])
  }, [flatRows])

  const estimates = useMemo(() => {
    const count = Math.max(selectedPersons.length, 1)
    return {
      csv: `${Math.max(6, count * 0.6).toFixed(0)} KB`,
      gedcom: `${Math.max(4, count * 0.4).toFixed(0)} KB`,
      png: `${Math.max(120, count * 32).toFixed(0)} KB`,
      xlsx: `${Math.max(12, count * 1.1).toFixed(0)} KB`,
    }
  }, [selectedPersons.length])

  function updateBranchSelection(personId: string) {
    const descendants = getDescendants(personId, childrenByParent)
    const ancestors = includeAncestors ? getAncestors(personId, personById) : new Set<string>()
    const affectedIds = new Set<string>([personId, ...descendants, ...ancestors])

    setSelectedIds((current) => {
      const next = new Set(current)
      const isAdding = !next.has(personId)

      for (const affectedId of affectedIds) {
        if (isAdding) {
          next.add(affectedId)
        } else {
          next.delete(affectedId)
        }
      }

      return next
    })
  }

  function augmentSelectionWithAncestors() {
    setSelectedIds((current) => {
      const next = new Set(current)
      for (const id of current) {
        for (const ancestorId of getAncestors(id, personById)) {
          next.add(ancestorId)
        }
      }
      return next
    })
  }

  function setExportProgress(format: ExportFormat | null, label: string, nextProgress: number) {
    setProgress({
      format,
      label,
      progress: nextProgress,
    })
  }

  function finalizeExport(type: ExportFormat, name: string, blob: Blob) {
    if (lastExport) {
      URL.revokeObjectURL(lastExport.url)
    }

    const url = triggerDownload(name, blob)
    setLastExport({ blob, name, type, url })
    setExportProgress(null, '', 0)
    setShareMessage('File berhasil diunduh.')
  }

  async function shareLastExport() {
    if (!lastExport) {
      return
    }

    const file = new File([lastExport.blob], lastExport.name, { type: lastExport.blob.type })
    const shareData = {
      files: [file],
      text: 'Ekspor keluarga dari Keluargaku',
      title: lastExport.name,
    }

    if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
      await navigator.share(shareData)
      return
    }

    await navigator.clipboard.writeText(lastExport.url)
    setShareMessage('Link file lokal disalin ke clipboard.')
  }

  async function exportPng() {
    if (!previewRef.current || selectedPersons.length === 0) {
      return
    }

    setExportProgress('png', 'PNG', 12)
    const html2canvas = await loadScript('html2canvas', HTML2CANVAS_SRC)
    setExportProgress('png', 'PNG', 45)

    const canvas = await html2canvas!(previewRef.current, {
      backgroundColor: '#FFF8F0',
      logging: false,
      scale: pngScale,
      useCORS: true,
      windowHeight: previewRef.current.scrollHeight,
      windowWidth: previewRef.current.scrollWidth,
    })

    setExportProgress('png', 'PNG', 82)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((nextBlob: Blob | null) => {
        if (!nextBlob) {
          reject(new Error('Gagal membuat PNG.'))
          return
        }
        resolve(nextBlob)
      }, 'image/png')
    })

    setExportProgress('png', 'PNG', 100)
    finalizeExport(`png`, `keluargaku-${formatFileDate()}.png`, blob)
  }

  async function exportXlsx() {
    if (selectedPersons.length === 0) {
      return
    }

    setExportProgress('xlsx', 'Excel', 10)
    const XLSX = await loadScript('XLSX', XLSX_SRC)
    const workbook = XLSX!.utils.book_new()
    setExportProgress('xlsx', 'Excel', 36)

    generationGroups.forEach(([generation, rows], index) => {
      const worksheet = XLSX!.utils.aoa_to_sheet([
        ['No', 'Nama Lengkap', 'Jenis Kelamin', 'Tanggal Lahir', 'Tanggal Wafat', 'Nama Ayah', 'Nama Ibu', 'Biografi'],
        ...rows.map((row) => [
          row.index,
          row.fullName,
          row.gender,
          row.birthDate,
          row.deathDate,
          row.fatherName,
          row.motherName,
          row.biography,
        ]),
      ])

      XLSX!.utils.book_append_sheet(workbook, worksheet, `Generasi ${generation}`)
      setExportProgress('xlsx', 'Excel', 36 + Math.round(((index + 1) / Math.max(generationGroups.length, 1)) * 48))
    })

    const arrayBuffer = XLSX!.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([arrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    setExportProgress('xlsx', 'Excel', 100)
    finalizeExport('xlsx', `keluargaku-${formatFileDate()}.xlsx`, blob)
  }

  async function exportCsv() {
    if (selectedPersons.length === 0) {
      return
    }

    setExportProgress('csv', 'CSV', 20)
    const header = ['No', 'Nama Lengkap', 'Jenis Kelamin', 'Tanggal Lahir', 'Tanggal Wafat', 'Nama Ayah', 'Nama Ibu', 'Biografi']
    const csvRows = [
      header,
      ...flatRows.map((row) => [
        String(row.index),
        row.fullName,
        row.gender,
        row.birthDate,
        row.deathDate,
        row.fatherName,
        row.motherName,
        row.biography,
      ]),
    ]

    setExportProgress('csv', 'CSV', 72)
    const csvContent = csvRows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(','),
      )
      .join('\r\n')
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
    setExportProgress('csv', 'CSV', 100)
    finalizeExport('csv', `keluargaku-${formatFileDate()}.csv`, blob)
  }

  async function exportGedcom() {
    if (selectedPersons.length === 0) {
      return
    }

    setExportProgress('gedcom', 'GEDCOM', 14)
    const selectedById = new Map(selectedPersons.map((person) => [person.id, person]))
    const individualIds = new Map(selectedPersons.map((person, index) => [person.id, `@I${index + 1}@`]))
    const familyGroups = new Map<
      string,
      {
        children: string[]
        parents: Array<string | null>
      }
    >()

    for (const person of selectedPersons) {
      if (person.fatherId || person.motherId) {
        const key = `${person.fatherId ?? ''}::${person.motherId ?? ''}`
        const group = familyGroups.get(key) ?? {
          children: [],
          parents: [person.fatherId, person.motherId],
        }
        group.children.push(person.id)
        familyGroups.set(key, group)
      } else if (person.spouseId && selectedById.has(person.spouseId)) {
        const pair = [person.id, person.spouseId].sort().join('::')
        if (!familyGroups.has(pair)) {
          familyGroups.set(pair, {
            children: [],
            parents: [person.id, person.spouseId],
          })
        }
      }
    }

    const familyIds = new Map(Array.from(familyGroups.keys()).map((key, index) => [key, `@F${index + 1}@`]))
    const gedcomLines: string[] = [
      '0 HEAD',
      '1 SOUR KELUARGAKU',
      '1 GEDC',
      '2 VERS 5.5.1',
      '2 FORM LINEAGE-LINKED',
      '1 CHAR UTF-8',
      `1 DATE ${formatGedcomDate(new Date().toISOString())}`,
    ]

    setExportProgress('gedcom', 'GEDCOM', 38)
    for (const person of selectedPersons) {
      gedcomLines.push(`${individualIds.get(person.id)} INDI`)
      gedcomLines.push(`1 NAME ${person.firstName} /${person.lastName || ''}/`)
      gedcomLines.push(
        `1 SEX ${person.gender === 'male' ? 'M' : person.gender === 'female' ? 'F' : 'U'}`,
      )
      if (person.birthDate) {
        gedcomLines.push('1 BIRT')
        gedcomLines.push(`2 DATE ${formatGedcomDate(person.birthDate)}`)
      }
      if (person.deathDate) {
        gedcomLines.push('1 DEAT')
        gedcomLines.push(`2 DATE ${formatGedcomDate(person.deathDate)}`)
      }
      if (person.biography) {
        gedcomLines.push(`1 NOTE ${clampText(person.biography, 180)}`)
      }

      for (const [familyKey, family] of familyGroups) {
        if (family.children.includes(person.id)) {
          gedcomLines.push(`1 FAMC ${familyIds.get(familyKey)}`)
        }

        if (family.parents.includes(person.id)) {
          gedcomLines.push(`1 FAMS ${familyIds.get(familyKey)}`)
        }
      }
    }

    setExportProgress('gedcom', 'GEDCOM', 72)
    for (const [familyKey, family] of familyGroups) {
      const familyId = familyIds.get(familyKey)
      if (!familyId) {
        continue
      }

      gedcomLines.push(`${familyId} FAM`)
      const [firstParentId, secondParentId] = family.parents
      const firstParent = firstParentId ? selectedById.get(firstParentId) : null
      const secondParent = secondParentId ? selectedById.get(secondParentId) : null

      function pushFamilyRole(person: Person | null, fallbackTag: 'HUSB' | 'WIFE') {
        if (!person) {
          return
        }

        const tag =
          person.gender === 'male'
            ? 'HUSB'
            : person.gender === 'female'
              ? 'WIFE'
              : fallbackTag
        gedcomLines.push(`1 ${tag} ${individualIds.get(person.id)}`)
      }

      pushFamilyRole(firstParent ?? null, 'HUSB')
      pushFamilyRole(secondParent ?? null, firstParent?.gender === 'male' ? 'WIFE' : 'HUSB')

      for (const childId of family.children) {
        const individualId = individualIds.get(childId)
        if (individualId) {
          gedcomLines.push(`1 CHIL ${individualId}`)
        }
      }
    }

    gedcomLines.push('0 TRLR')
    const blob = new Blob([gedcomLines.join('\r\n')], {
      type: 'text/plain;charset=utf-8',
    })
    setExportProgress('gedcom', 'GEDCOM', 100)
    finalizeExport('gedcom', `keluargaku-${formatFileDate()}.ged`, blob)
  }

  const cards = [
    {
      description: 'Tangkap pohon keluarga menjadi gambar siap simpan atau cetak.',
      estimate: estimates.png,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24">
          <rect height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" width="18" x="3" y="5" />
          <circle cx="8" cy="10" fill="currentColor" r="1.5" />
          <path d="M5.5 16L10 11.5L13 14.5L16.5 11L18.5 13V16H5.5Z" fill="currentColor" />
        </svg>
      ),
      label: 'PNG image of the tree',
      type: 'png' as const,
      action: exportPng,
    },
    {
      description: 'Spreadsheet berlapis generasi untuk audit, arsip, atau cetak keluarga.',
      estimate: estimates.xlsx,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path d="M6 4.5H15L19 8.5V19.5H6V4.5Z" stroke="currentColor" strokeWidth="1.7" />
          <path d="M15 4.5V8.5H19" stroke="currentColor" strokeWidth="1.7" />
          <path d="M9 11L12 15L15 11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
        </svg>
      ),
      label: 'Excel spreadsheet (.xlsx)',
      type: 'xlsx' as const,
      action: exportXlsx,
    },
    {
      description: 'Format ringan dan ramah perangkat untuk dibuka di banyak aplikasi.',
      estimate: estimates.csv,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path d="M5 5.5H19V18.5H5V5.5Z" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8 9.5H16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
          <path d="M8 13H16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
          <path d="M8 16.5H13" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        </svg>
      ),
      label: 'CSV (broad device support)',
      type: 'csv' as const,
      action: exportCsv,
    },
    {
      description: 'Standar silsilah untuk diimpor ke FamilySearch, Gramps, dan aplikasi lain.',
      estimate: estimates.gedcom,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="6.5" fill="currentColor" r="2.5" />
          <circle cx="6.5" cy="17" fill="currentColor" r="2.5" />
          <circle cx="17.5" cy="17" fill="currentColor" r="2.5" />
          <path d="M12 9V13" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 13L7.5 15.5" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 13L16.5 15.5" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      ),
      label: 'GEDCOM (.ged)',
      type: 'gedcom' as const,
      action: exportGedcom,
    },
  ]

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6">
      {shareMessage ? (
        <div className="app-toast fixed bottom-5 z-50 -translate-x-1/2 rounded-full bg-soft-green px-5 py-3 text-sm text-cream shadow-[0_18px_38px_rgba(90,122,74,0.28)]">
          {shareMessage}
        </div>
      ) : null}

      <div className="rounded-[2rem] border border-warm-brown/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(255,248,240,0.86),rgba(90,122,74,0.12))] p-6 shadow-[0_28px_70px_rgba(124,74,45,0.08)]">
        <p className="text-xs uppercase tracking-[0.3em] text-soft-green">Export arsip</p>
        <h1 className="mt-3 font-serif text-4xl text-warm-brown">Pilih siapa yang dibawa pulang, lalu pilih formatnya.</h1>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-warm-brown/70">
          Anda bisa mengekspor seluruh keluarga atau cabang tertentu dalam format gambar, spreadsheet, CSV, atau GEDCOM.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-warm-brown/10 bg-white/72 p-5 shadow-[0_20px_60px_rgba(124,74,45,0.06)]">
            <p className="text-xs uppercase tracking-[0.28em] text-soft-green">Mode A</p>
            <h2 className="mt-2 font-serif text-3xl text-warm-brown">Select who to export</h2>

            <div className="mt-5 space-y-3">
              <button
                className={`w-full rounded-[1.3rem] border px-4 py-4 text-left transition ${
                  exportMode === 'all'
                    ? 'border-soft-green bg-soft-green text-cream'
                    : 'border-warm-brown/10 bg-cream/50 text-warm-brown hover:bg-cream'
                }`}
                onClick={() => setExportMode('all')}
                type="button"
              >
                <p className="font-medium">Semua anggota</p>
                <p className={`mt-2 text-sm ${exportMode === 'all' ? 'text-cream/80' : 'text-warm-brown/55'}`}>
                  Gunakan seluruh data keluarga saat ini.
                </p>
              </button>

              <button
                className={`w-full rounded-[1.3rem] border px-4 py-4 text-left transition ${
                  exportMode === 'family'
                    ? 'border-soft-green bg-soft-green text-cream'
                    : 'border-warm-brown/10 bg-cream/50 text-warm-brown hover:bg-cream'
                }`}
                onClick={() => setExportMode('family')}
                type="button"
              >
                <p className="font-medium">Pilih keluarga</p>
                <p className={`mt-2 text-sm ${exportMode === 'family' ? 'text-cream/80' : 'text-warm-brown/55'}`}>
                  Pilih cabang tertentu, lalu turunan akan ikut tercentang otomatis.
                </p>
              </button>
            </div>

            {exportMode === 'family' ? (
              <div className="mt-5 rounded-[1.3rem] border border-warm-brown/10 bg-cream/55 px-4 py-4">
                <label className="flex items-start gap-3">
                  <input
                    checked={includeAncestors}
                    className="mt-1 h-4 w-4 accent-soft-green"
                    onChange={(event) => {
                      setIncludeAncestors(event.target.checked)
                      if (event.target.checked) {
                        augmentSelectionWithAncestors()
                      }
                    }}
                    type="checkbox"
                  />
                  <span className="text-sm leading-6 text-warm-brown/72">
                    Sertakan leluhur juga saat memilih seseorang.
                  </span>
                </label>
              </div>
            ) : null}

            <div className="mt-5 rounded-[1.4rem] bg-muted-gold/12 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-soft-green">Counter</p>
              <p className="mt-2 font-serif text-3xl text-warm-brown">
                {selectedPersons.length} anggota dipilih
              </p>
            </div>
          </section>

          {lastExport ? (
            <section className="rounded-[2rem] border border-warm-brown/10 bg-white/72 p-5 shadow-[0_20px_60px_rgba(124,74,45,0.06)]">
              <p className="text-xs uppercase tracking-[0.28em] text-soft-green">Setelah download</p>
              <h2 className="mt-2 font-serif text-2xl text-warm-brown">File siap dibagikan.</h2>
              <p className="mt-3 text-sm leading-7 text-warm-brown/68">{lastExport.name}</p>
              <button
                className="mt-5 rounded-full border border-soft-green/20 bg-soft-green/10 px-5 py-3 text-sm text-soft-green transition hover:bg-soft-green hover:text-cream"
                onClick={() => {
                  void shareLastExport()
                }}
                type="button"
              >
                Bagikan
              </button>
            </section>
          ) : null}
        </aside>

      <div className="space-y-6">
          <div className="pointer-events-none fixed left-[-9999px] top-0 opacity-0" ref={previewRef}>
            {selectedPersons.length > 0 ? <ExportPreviewTree persons={selectedPersons} scrollable={false} /> : null}
          </div>

          {exportMode === 'family' ? (
            <section className="rounded-[2rem] border border-warm-brown/10 bg-white/72 p-5 shadow-[0_20px_60px_rgba(124,74,45,0.06)]">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-soft-green">Read-only tree</p>
                  <h2 className="mt-2 font-serif text-3xl text-warm-brown">Centang node yang ingin diekspor.</h2>
                </div>
                <button
                  className="rounded-full border border-warm-brown/15 px-4 py-2 text-sm text-warm-brown transition hover:bg-cream"
                  onClick={() => setSelectedIds(new Set())}
                  type="button"
                >
                  Reset
                </button>
              </div>
              <div className="mt-5">
                <TreeSelectionSvg
                  layoutPersons={persons}
                  onToggle={updateBranchSelection}
                  selectedIds={effectiveSelectedIds}
                />
              </div>
            </section>
          ) : null}

          <section className="rounded-[2rem] border border-warm-brown/10 bg-white/72 p-5 shadow-[0_20px_60px_rgba(124,74,45,0.06)]">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-soft-green">Mode B</p>
                <h2 className="mt-2 font-serif text-3xl text-warm-brown">Choose export format</h2>
              </div>

              <div className="rounded-[1.4rem] border border-warm-brown/10 bg-cream/55 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-soft-green">Resolution</p>
                <div className="mt-2 flex gap-2">
                  {[1, 2].map((scale) => (
                    <button
                      className={`rounded-full px-4 py-2 text-sm transition ${
                        pngScale === scale
                          ? 'bg-soft-green text-cream'
                          : 'bg-white text-warm-brown hover:bg-cream'
                      }`}
                      key={scale}
                      onClick={() => setPngScale(scale as 1 | 2)}
                      type="button"
                    >
                      {scale}×
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              {cards.map((card) => (
                <ExportCard
                  action={() => {
                    void card.action()
                  }}
                  description={card.description}
                  disabled={selectedPersons.length === 0}
                  estimate={card.estimate}
                  icon={card.icon}
                  isActive={progress.format === card.type}
                  isComplete={lastExport?.type === card.type && progress.format !== card.type}
                  key={card.type}
                  label={card.label}
                  progress={progress.format === card.type ? progress.progress : 0}
                />
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-warm-brown/10 bg-white/72 p-5 shadow-[0_20px_60px_rgba(124,74,45,0.06)]">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-soft-green">Preview export</p>
                <h2 className="mt-2 font-serif text-3xl text-warm-brown">Pohon yang akan dikirim keluar.</h2>
              </div>
              <p className="text-sm text-warm-brown/55">
                {generationGroups.length} generasi / {selectedPersons.length} anggota
              </p>
            </div>

            <div className="mt-5">
              {selectedPersons.length > 0 ? (
                <ExportPreviewTree persons={selectedPersons} />
              ) : (
                <div className="rounded-[1.6rem] border border-dashed border-warm-brown/20 bg-cream/40 px-5 py-10 text-center">
                  <p className="font-serif text-2xl text-warm-brown">Belum ada anggota terpilih.</p>
                  <p className="mt-3 text-sm text-warm-brown/60">
                    Pilih anggota keluarga terlebih dahulu untuk melihat preview dan mengaktifkan ekspor.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}
