import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFullName, getInitials } from '../lib/familyData'
import type { Person } from '../types/family'

const MIN_SCALE = 0.4
const MAX_SCALE = 2.5
const MINIMAP_WIDTH = 120
const MINIMAP_HEIGHT = 80

export interface TreeNodeSize {
  width: number
  height: number
  avatar: number
  nameFontSize: number
  nameLineHeight: number
  birthFontSize: number
  padding: number
  birthY: number
  nameY: number
  nameCharsPerLine: number
}

export interface TreeNodeLayout {
  person: Person
  generation: number
  height: number
  width: number
  x: number
  y: number
}

export interface TreeEdgeLayout {
  key: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
}

export interface MarriageLayout {
  key: string
  midpointX: number
  midpointY: number
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
}

export interface TreeBounds {
  height: number
  maxX: number
  maxY: number
  minX: number
  minY: number
  width: number
}

export interface TreeLayout {
  bounds: TreeBounds
  edges: TreeEdgeLayout[]
  marriages: MarriageLayout[]
  nodes: TreeNodeLayout[]
}

interface TransformState {
  scale: number
  x: number
  y: number
}

interface Point {
  x: number
  y: number
}

interface FamilyTreeCanvasProps {
  focusId?: string
  persons: Person[]
  pulseId?: string
  pulseToken?: string
  searchQuery: string
  selectedId?: string
}

export interface CoupleGroup {
  childIds: string[]
  parents: [string, string]
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getYearLabel(date: string) {
  return Number.isNaN(new Date(date).getTime()) ? 'Tahun ?' : String(new Date(date).getFullYear())
}

export function makePairKey(firstId: string, secondId: string) {
  return [firstId, secondId].sort().join('::')
}

export function buildCouples(persons: Person[]) {
  const groups = new Map<string, CoupleGroup>()

  for (const person of persons) {
    if (!person.spouseId) {
      continue
    }

    const key = makePairKey(person.id, person.spouseId)
    if (!groups.has(key)) {
      groups.set(key, {
        parents: [person.id, person.spouseId].sort() as [string, string],
        childIds: [],
      })
    }
  }

  for (const person of persons) {
    if (!person.fatherId || !person.motherId) {
      continue
    }

    const key = makePairKey(person.fatherId, person.motherId)
    const existing = groups.get(key)

    if (existing) {
      existing.childIds.push(person.id)
      continue
    }

    groups.set(key, {
      parents: [person.fatherId, person.motherId].sort() as [string, string],
      childIds: [person.id],
    })
  }

  return groups
}

export function buildPrimarySpouseMap(couples: Map<string, CoupleGroup>) {
  const entries = Array.from(couples.values()).sort(
    (left, right) => right.childIds.length - left.childIds.length,
  )
  const primarySpouseById = new Map<string, string>()

  for (const couple of entries) {
    const [firstId, secondId] = couple.parents

    if (!primarySpouseById.has(firstId)) {
      primarySpouseById.set(firstId, secondId)
    }

    if (!primarySpouseById.has(secondId)) {
      primarySpouseById.set(secondId, firstId)
    }
  }

  return primarySpouseById
}

export function buildChildrenMap(persons: Person[]) {
  const childrenByParent = new Map<string, Person[]>()

  for (const person of persons) {
    for (const parentId of [person.fatherId, person.motherId]) {
      if (!parentId) {
        continue
      }

      const current = childrenByParent.get(parentId)

      if (current) {
        current.push(person)
      } else {
        childrenByParent.set(parentId, [person])
      }
    }
  }

  for (const children of childrenByParent.values()) {
    children.sort((left, right) => left.birthDate.localeCompare(right.birthDate))
  }

  return childrenByParent
}

function getVisiblePersons(persons: Person[], searchQuery: string) {
  const search = searchQuery.trim().toLowerCase()

  if (!search) {
    return persons
  }

  const personById = new Map(persons.map((person) => [person.id, person]))
  const childrenByParent = buildChildrenMap(persons)
  const couples = buildCouples(persons)
  const primarySpouseById = buildPrimarySpouseMap(couples)

  const matchesPerson = (person: Person) => getFullName(person).toLowerCase().includes(search)
  const branchMemo = new Map<string, boolean>()

  function getUnitChildren(personId: string) {
    const spouseId = primarySpouseById.get(personId)
    const mergedChildren = new Map<string, Person>()

    for (const child of childrenByParent.get(personId) ?? []) {
      mergedChildren.set(child.id, child)
    }

    if (spouseId) {
      for (const child of childrenByParent.get(spouseId) ?? []) {
        mergedChildren.set(child.id, child)
      }
    }

    return Array.from(mergedChildren.values()).sort((left, right) =>
      left.birthDate.localeCompare(right.birthDate),
    )
  }

  function branchMatches(personId: string): boolean {
    if (branchMemo.has(personId)) {
      return branchMemo.get(personId) ?? false
    }

    const person = personById.get(personId)

    if (!person) {
      branchMemo.set(personId, false)
      return false
    }

    const spouse = primarySpouseById.get(personId)
      ? personById.get(primarySpouseById.get(personId) ?? '')
      : null

    const result =
      matchesPerson(person) ||
      Boolean(spouse && matchesPerson(spouse)) ||
      getUnitChildren(personId).some((child) => branchMatches(child.id))

    branchMemo.set(personId, result)
    return result
  }

  const visibleIds = new Set<string>()
  const roots = persons.filter(
    (person) =>
      (!person.fatherId || !personById.has(person.fatherId)) &&
      (!person.motherId || !personById.has(person.motherId)),
  )

  function walkBranch(personId: string) {
    if (visibleIds.has(personId)) {
      return
    }

    visibleIds.add(personId)
    const spouseId = primarySpouseById.get(personId)

    if (spouseId && branchMatches(personId)) {
      visibleIds.add(spouseId)
    }

    for (const child of getUnitChildren(personId)) {
      if (branchMatches(child.id)) {
        walkBranch(child.id)
      }
    }
  }

  const branchRoots = roots.length > 0 ? roots : persons

  for (const root of branchRoots) {
    if (branchMatches(root.id)) {
      walkBranch(root.id)
    }
  }

  return persons.filter((person) => visibleIds.has(person.id))
}

export function computeGenerations(
  persons: Person[],
  personById: Map<string, Person>,
  couples: Map<string, CoupleGroup>,
) {
  const generationById = new Map<string, number>()
  const visiting = new Set<string>()

  function resolveGeneration(personId: string): number {
    if (generationById.has(personId)) {
      return generationById.get(personId) ?? 0
    }

    if (visiting.has(personId)) {
      return 0
    }

    visiting.add(personId)
    const person = personById.get(personId)

    if (!person) {
      visiting.delete(personId)
      return 0
    }

    const parentGenerations = [person.fatherId, person.motherId]
      .filter((parentId): parentId is string => Boolean(parentId && personById.has(parentId)))
      .map((parentId) => resolveGeneration(parentId))

    const generation = parentGenerations.length > 0 ? Math.max(...parentGenerations) + 1 : 0
    generationById.set(personId, generation)
    visiting.delete(personId)
    return generation
  }

  for (const person of persons) {
    resolveGeneration(person.id)
  }

  let changed = true

  while (changed) {
    changed = false

    for (const couple of couples.values()) {
      const childGenerations = couple.childIds
        .map((childId) => generationById.get(childId))
        .filter((generation): generation is number => typeof generation === 'number')

      if (childGenerations.length === 0) {
        continue
      }

      const targetGeneration = Math.max(...childGenerations) - 1

      for (const parentId of couple.parents) {
        const currentGeneration = generationById.get(parentId) ?? 0
        if (currentGeneration < targetGeneration) {
          generationById.set(parentId, targetGeneration)
          changed = true
        }
      }
    }
  }

  return generationById
}

export function computeTreeLayout(persons: Person[], nodeSize: TreeNodeSize): TreeLayout {
  const personById = new Map(persons.map((person) => [person.id, person]))
  const couples = buildCouples(persons)
  const primarySpouseById = buildPrimarySpouseMap(couples)
  const generationById = computeGenerations(persons, personById, couples)
  const peopleByGeneration = new Map<number, Person[]>()
  const orderById = new Map<string, number>()

  for (const person of persons) {
    const generation = generationById.get(person.id) ?? 0
    const current = peopleByGeneration.get(generation)

    if (current) {
      current.push(person)
    } else {
      peopleByGeneration.set(generation, [person])
    }
  }

  const generations = Array.from(peopleByGeneration.keys()).sort((left, right) => left - right)

  for (const generation of generations) {
    const entries = peopleByGeneration.get(generation) ?? []

    entries.sort((left, right) => {
      const leftParents = [left.fatherId, left.motherId]
        .filter((parentId): parentId is string => Boolean(parentId && orderById.has(parentId)))
        .map((parentId) => orderById.get(parentId) ?? 0)
      const rightParents = [right.fatherId, right.motherId]
        .filter((parentId): parentId is string => Boolean(parentId && orderById.has(parentId)))
        .map((parentId) => orderById.get(parentId) ?? 0)

      const leftAnchor =
        leftParents.length > 0
          ? leftParents.reduce((sum, value) => sum + value, 0) / leftParents.length
          : orderById.get(primarySpouseById.get(left.id) ?? '') ?? Number.POSITIVE_INFINITY
      const rightAnchor =
        rightParents.length > 0
          ? rightParents.reduce((sum, value) => sum + value, 0) / rightParents.length
          : orderById.get(primarySpouseById.get(right.id) ?? '') ?? Number.POSITIVE_INFINITY

      if (leftAnchor !== rightAnchor) {
        return leftAnchor - rightAnchor
      }

      const birthComparison = left.birthDate.localeCompare(right.birthDate)
      if (birthComparison !== 0) {
        return birthComparison
      }

      return getFullName(left).localeCompare(getFullName(right))
    })

    entries.forEach((person, index) => {
      orderById.set(person.id, index)
    })
  }

  const coupleGap = nodeSize.width * 0.22
  const unitGap = nodeSize.width * 0.5
  const rowGap = nodeSize.height + (nodeSize.width >= 80 ? 92 : 74)
  const paddingX = nodeSize.width >= 80 ? 80 : 52
  const paddingY = nodeSize.width >= 80 ? 56 : 40
  const positionedNodes: TreeNodeLayout[] = []
  const nodeById = new Map<string, TreeNodeLayout>()
  const rowUnits = generations.map((generation) => {
    const entries = peopleByGeneration.get(generation) ?? []
    const processed = new Set<string>()
    const units: Person[][] = []
    const indexById = new Map(entries.map((person, index) => [person.id, index]))

    for (const person of entries) {
      if (processed.has(person.id)) {
        continue
      }

      const spouseId = primarySpouseById.get(person.id)
      const spouseGeneration = spouseId ? generationById.get(spouseId) : undefined

      if (
        spouseId &&
        spouseGeneration === generation &&
        !processed.has(spouseId) &&
        indexById.has(spouseId)
      ) {
        const spouse = personById.get(spouseId)
        if (spouse) {
          const pair = [person, spouse].sort(
            (left, right) => (indexById.get(left.id) ?? 0) - (indexById.get(right.id) ?? 0),
          )
          units.push(pair)
          processed.add(person.id)
          processed.add(spouseId)
          continue
        }
      }

      units.push([person])
      processed.add(person.id)
    }

    return { generation, units }
  })

  const rowWidths = rowUnits.map(({ units }) =>
    units.reduce((total, unit, unitIndex) => {
      const unitWidth = unit.length * nodeSize.width + (unit.length - 1) * coupleGap
      return total + unitWidth + (unitIndex > 0 ? unitGap : 0)
    }, 0),
  )
  const maxRowWidth = Math.max(...rowWidths, nodeSize.width)

  rowUnits.forEach(({ generation, units }, rowIndex) => {
    let cursorX = paddingX + (maxRowWidth - rowWidths[rowIndex]) / 2
    const rowY = paddingY + generation * rowGap

    units.forEach((unit, unitIndex) => {
      if (unitIndex > 0) {
        cursorX += unitGap
      }

      unit.forEach((person, personIndex) => {
        const x = cursorX + personIndex * (nodeSize.width + coupleGap)
        const layout: TreeNodeLayout = {
          person,
          generation,
          height: nodeSize.height,
          width: nodeSize.width,
          x,
          y: rowY,
        }

        positionedNodes.push(layout)
        nodeById.set(person.id, layout)
      })

      cursorX += unit.length * nodeSize.width + (unit.length - 1) * coupleGap
    })
  })

  const marriages: MarriageLayout[] = []
  const edges: TreeEdgeLayout[] = []

  for (const [key, couple] of couples) {
    const first = nodeById.get(couple.parents[0])
    const second = nodeById.get(couple.parents[1])

    if (!first || !second || first.generation !== second.generation) {
      continue
    }

    const sourceX = first.x + first.width / 2
    const targetX = second.x + second.width / 2
    const marriageY = first.y + first.height + 18
    const midpointX = (sourceX + targetX) / 2

    marriages.push({
      key,
      midpointX,
      midpointY: marriageY,
      sourceX,
      sourceY: marriageY,
      targetX,
      targetY: marriageY,
    })

    for (const childId of couple.childIds) {
      const child = nodeById.get(childId)

      if (!child) {
        continue
      }

      edges.push({
        key: `${key}-${childId}`,
        sourceX: midpointX,
        sourceY: marriageY,
        targetX: child.x + child.width / 2,
        targetY: child.y,
      })
    }
  }

  for (const child of persons) {
    const childNode = nodeById.get(child.id)

    if (!childNode) {
      continue
    }

    const directParents = [child.fatherId, child.motherId]
      .filter((parentId): parentId is string => Boolean(parentId))
      .map((parentId) => nodeById.get(parentId))
      .filter((node): node is TreeNodeLayout => Boolean(node))

    const hasMarriageEdge =
      child.fatherId &&
      child.motherId &&
      couples.has(makePairKey(child.fatherId, child.motherId))

    if (hasMarriageEdge) {
      continue
    }

    directParents.forEach((parentNode) => {
      edges.push({
        key: `${parentNode.person.id}-${child.id}`,
        sourceX: parentNode.x + parentNode.width / 2,
        sourceY: parentNode.y + parentNode.height,
        targetX: childNode.x + childNode.width / 2,
        targetY: childNode.y,
      })
    })
  }

  const maxX = paddingX * 2 + maxRowWidth
  const maxY =
    (generations.length > 0 ? paddingY + generations.length * rowGap : paddingY) + nodeSize.height
  const bounds = {
    minX: 0,
    minY: 0,
    maxX,
    maxY,
    width: maxX,
    height: maxY,
  }

  return {
    bounds,
    edges,
    marriages,
    nodes: positionedNodes,
  }
}

function fitTransform(bounds: TreeBounds, viewport: { height: number; width: number }): TransformState {
  const framePadding = 36
  const scale = clamp(
    Math.min(
      (viewport.width - framePadding * 2) / Math.max(bounds.width, 1),
      (viewport.height - framePadding * 2) / Math.max(bounds.height, 1),
    ),
    MIN_SCALE,
    MAX_SCALE,
  )

  return {
    scale,
    x: viewport.width / 2 - (bounds.minX + bounds.width / 2) * scale,
    y: viewport.height / 2 - (bounds.minY + bounds.height / 2) * scale,
  }
}

function getScreenPoint(container: HTMLDivElement, clientX: number, clientY: number): Point {
  const rect = container.getBoundingClientRect()
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  }
}

function getDistance(first: Point, second: Point) {
  return Math.hypot(second.x - first.x, second.y - first.y)
}

function splitNameLines(name: string, charsPerLine: number) {
  const words = name.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word

    if (candidate.length <= charsPerLine || currentLine.length === 0) {
      currentLine = candidate
      continue
    }

    lines.push(currentLine)
    currentLine = word

    if (lines.length === 1) {
      continue
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  const trimmed = lines.slice(0, 2)

  if (lines.length > 2 && trimmed[1]) {
    trimmed[1] = `${trimmed[1].slice(0, Math.max(charsPerLine - 1, 1)).trimEnd()}…`
  }

  if (trimmed.length === 1 && trimmed[0].length > charsPerLine * 2) {
    return [trimmed[0].slice(0, charsPerLine), `${trimmed[0].slice(charsPerLine, charsPerLine * 2 - 1)}…`]
  }

  return trimmed
}

export function makeConnectorPath(edge: TreeEdgeLayout) {
  const controlOffset = Math.max((edge.targetY - edge.sourceY) * 0.45, 24)
  const controlY1 = edge.sourceY + controlOffset
  const controlY2 = edge.targetY - controlOffset

  return `M ${edge.sourceX} ${edge.sourceY} C ${edge.sourceX} ${controlY1}, ${edge.targetX} ${controlY2}, ${edge.targetX} ${edge.targetY}`
}

function ToolbarButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-warm-brown/10 bg-white/90 text-warm-brown shadow-[0_16px_35px_rgba(124,74,45,0.12)] transition hover:-translate-y-0.5 hover:border-soft-green/30 hover:text-soft-green"
      onClick={onClick}
      title={label}
      type="button"
    >
      <span className="sr-only">{label}</span>
      {children}
    </button>
  )
}

export default function FamilyTreeCanvas({
  focusId,
  persons,
  pulseId,
  pulseToken,
  searchQuery,
  selectedId,
}: FamilyTreeCanvasProps) {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const transformRef = useRef<TransformState>({ scale: 1, x: 0, y: 0 })
  const pointersRef = useRef(new Map<number, Point>())
  const dragStateRef = useRef<{ start: Point; transform: TransformState } | null>(null)
  const pinchStateRef = useRef<{
    midpointWorld: Point
    startDistance: number
    startTransform: TransformState
  } | null>(null)
  const movedDuringGestureRef = useRef(false)
  const lastFocusIdRef = useRef<string | null>(null)
  const lastPulseTokenRef = useRef<string | null>(null)
  const [viewport, setViewport] = useState({ height: 0, isMobile: false, width: 0 })
  const [transform, setTransform] = useState<TransformState>({ scale: 1, x: 0, y: 0 })
  const [activePulseId, setActivePulseId] = useState<string | null>(null)
  const [loadedNodeImages, setLoadedNodeImages] = useState<Record<string, boolean>>({})

  useEffect(() => {
    transformRef.current = transform
  }, [transform])

  useEffect(() => {
    const node = containerRef.current
    if (!node) {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]

      if (!entry) {
        return
      }

      const width = Math.max(Math.round(entry.contentRect.width), 320)
      const height = Math.max(Math.round(entry.contentRect.height), 420)

      setViewport({
        width,
        height,
        isMobile: width < 640,
      })
    })

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [])

  const visiblePersons = useMemo(
    () => getVisiblePersons(persons, searchQuery),
    [persons, searchQuery],
  )
  const nodeSize = useMemo<TreeNodeSize>(
    () =>
      viewport.isMobile
        ? {
            width: 64,
            height: 76,
            avatar: 28,
            nameFontSize: 10,
            nameLineHeight: 11,
            birthFontSize: 9,
            padding: 6,
            birthY: 68,
            nameY: 45,
            nameCharsPerLine: 11,
          }
        : {
            width: 80,
            height: 96,
            avatar: 40,
            nameFontSize: 12,
            nameLineHeight: 13,
            birthFontSize: 10,
            padding: 8,
            birthY: 86,
            nameY: 62,
            nameCharsPerLine: 13,
          },
    [viewport.isMobile],
  )
  const layout = useMemo(() => computeTreeLayout(visiblePersons, nodeSize), [nodeSize, visiblePersons])
  const layoutKey = useMemo(
    () =>
      `${visiblePersons.map((person) => person.id).join(',')}|${viewport.width}x${viewport.height}|${nodeSize.width}`,
    [nodeSize.width, viewport.height, viewport.width, visiblePersons],
  )

  useEffect(() => {
    if (viewport.width === 0 || viewport.height === 0 || layout.nodes.length === 0) {
      return
    }

    const nextTransform = fitTransform(layout.bounds, viewport)
    setTransform(nextTransform)
    transformRef.current = nextTransform
  }, [layout.bounds, layout.nodes.length, layoutKey, viewport])

  useEffect(() => {
    if (!focusId) {
      lastFocusIdRef.current = null
    }
  }, [focusId])

  useEffect(() => {
    if (!pulseId || !pulseToken) {
      return
    }

    if (lastPulseTokenRef.current === pulseToken) {
      return
    }

    lastPulseTokenRef.current = pulseToken
    setActivePulseId(pulseId)

    const timeout = window.setTimeout(() => {
      setActivePulseId((current) => (current === pulseId ? null : current))
    }, 620)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [pulseId, pulseToken])

  useEffect(() => {
    if (!focusId || layout.nodes.length === 0 || viewport.width === 0 || viewport.height === 0) {
      return
    }

    if (lastFocusIdRef.current === focusId) {
      return
    }

    const targetNode = layout.nodes.find((node) => node.person.id === focusId)
    if (!targetNode) {
      return
    }

    lastFocusIdRef.current = focusId
    setTransform((current) => {
      const next = {
        scale: current.scale,
        x: viewport.width / 2 - (targetNode.x + targetNode.width / 2) * current.scale,
        y: viewport.height / 2 - (targetNode.y + targetNode.height / 2) * current.scale,
      }
      transformRef.current = next
      return next
    })
  }, [focusId, layout.nodes, viewport.height, viewport.width])

  function screenToWorld(point: Point, state = transformRef.current): Point {
    return {
      x: (point.x - state.x) / state.scale,
      y: (point.y - state.y) / state.scale,
    }
  }

  function zoomAt(nextScale: number, point: Point) {
    const boundedScale = clamp(nextScale, MIN_SCALE, MAX_SCALE)
    setTransform((current) => {
      const worldPoint = screenToWorld(point, current)
      const next = {
        scale: boundedScale,
        x: point.x - worldPoint.x * boundedScale,
        y: point.y - worldPoint.y * boundedScale,
      }
      transformRef.current = next
      return next
    })
  }

  function centerOnNode(personId?: string | null) {
    const targetNode =
      layout.nodes.find((node) => node.person.id === personId) ??
      layout.nodes.find((node) => node.person.id === selectedId) ??
      layout.nodes[0]

    if (!targetNode) {
      return
    }

    setTransform((current) => {
      const next = {
        scale: current.scale,
        x: viewport.width / 2 - (targetNode.x + targetNode.width / 2) * current.scale,
        y: viewport.height / 2 - (targetNode.y + targetNode.height / 2) * current.scale,
      }
      transformRef.current = next
      return next
    })
  }

  const minimapScale = Math.min(
    MINIMAP_WIDTH / Math.max(layout.bounds.width, 1),
    MINIMAP_HEIGHT / Math.max(layout.bounds.height, 1),
  )
  const minimapOffsetX = (MINIMAP_WIDTH - layout.bounds.width * minimapScale) / 2
  const minimapOffsetY = (MINIMAP_HEIGHT - layout.bounds.height * minimapScale) / 2
  const maxGeneration = layout.nodes.reduce((highest, node) => Math.max(highest, node.generation), 0)
  const lineAnimationDelay = maxGeneration * 80 + 320
  const viewportRect = {
    x: minimapOffsetX + ((-transform.x / transform.scale) - layout.bounds.minX) * minimapScale,
    y: minimapOffsetY + ((-transform.y / transform.scale) - layout.bounds.minY) * minimapScale,
    width: (viewport.width / Math.max(transform.scale, 0.001)) * minimapScale,
    height: (viewport.height / Math.max(transform.scale, 0.001)) * minimapScale,
  }
  const showSkeleton = viewport.width === 0 || viewport.height === 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-soft-green">Tampilan silsilah</p>
          <h2 className="mt-2 font-serif text-3xl text-warm-brown">
            {searchQuery.trim() ? `Hasil pencarian untuk "${searchQuery}"` : 'Akar hingga generasi terbaru'}
          </h2>
        </div>
        <p className="text-sm text-warm-brown/55">{visiblePersons.length} anggota sedang ditampilkan</p>
      </div>

      {visiblePersons.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-warm-brown/20 bg-white/55 px-6 py-10 text-center">
          <p className="font-serif text-2xl text-warm-brown">Belum ada nama yang cocok.</p>
          <p className="mt-3 text-sm text-warm-brown/65">
            Coba kata kunci lain, atau tambahkan anggota keluarga baru agar pohon ini terus tumbuh.
          </p>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-[2rem] border border-warm-brown/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(255,248,240,0.94))] shadow-[0_28px_70px_rgba(124,74,45,0.08)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(201,148,58,0.18),transparent_70%)]" />
          {showSkeleton ? (
            <div className="absolute inset-0 z-10 grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 10 }).map((_, index) => (
                <div
                  className="skeleton-shimmer rounded-[1.4rem] border border-warm-brown/8 bg-white/75"
                  key={`tree-skeleton-${index}`}
                />
              ))}
            </div>
          ) : null}
          <div
            className="family-tree-canvas relative h-[62svh] min-h-[460px] w-full touch-none sm:h-[68svh] lg:min-h-[560px]"
            onPointerCancel={(event) => {
              pointersRef.current.delete(event.pointerId)
              dragStateRef.current = null
              pinchStateRef.current = null
            }}
            onPointerDown={(event) => {
              const container = containerRef.current
              if (!container) {
                return
              }

              if (event.pointerType === 'mouse' && event.button !== 0) {
                return
              }

              event.currentTarget.setPointerCapture(event.pointerId)
              const point = getScreenPoint(container, event.clientX, event.clientY)
              pointersRef.current.set(event.pointerId, point)
              movedDuringGestureRef.current = false

              if (event.pointerType === 'touch' && pointersRef.current.size >= 2) {
                const touchPoints = Array.from(pointersRef.current.values()).slice(0, 2)
                const midpoint = {
                  x: (touchPoints[0].x + touchPoints[1].x) / 2,
                  y: (touchPoints[0].y + touchPoints[1].y) / 2,
                }
                pinchStateRef.current = {
                  midpointWorld: screenToWorld(midpoint),
                  startDistance: Math.max(getDistance(touchPoints[0], touchPoints[1]), 1),
                  startTransform: transformRef.current,
                }
                dragStateRef.current = null
                return
              }

              if (event.pointerType !== 'touch') {
                dragStateRef.current = {
                  start: point,
                  transform: transformRef.current,
                }
              }
            }}
            onPointerMove={(event) => {
              const container = containerRef.current
              if (!container || !pointersRef.current.has(event.pointerId)) {
                return
              }

              const point = getScreenPoint(container, event.clientX, event.clientY)
              pointersRef.current.set(event.pointerId, point)

              if (event.pointerType === 'touch' && pointersRef.current.size >= 2 && pinchStateRef.current) {
                const touchPoints = Array.from(pointersRef.current.values()).slice(0, 2)
                const midpoint = {
                  x: (touchPoints[0].x + touchPoints[1].x) / 2,
                  y: (touchPoints[0].y + touchPoints[1].y) / 2,
                }
                const scaleDelta =
                  getDistance(touchPoints[0], touchPoints[1]) / pinchStateRef.current.startDistance
                const nextScale = clamp(
                  pinchStateRef.current.startTransform.scale * scaleDelta,
                  MIN_SCALE,
                  MAX_SCALE,
                )
                const nextTransform = {
                  scale: nextScale,
                  x: midpoint.x - pinchStateRef.current.midpointWorld.x * nextScale,
                  y: midpoint.y - pinchStateRef.current.midpointWorld.y * nextScale,
                }

                movedDuringGestureRef.current = true
                transformRef.current = nextTransform
                setTransform(nextTransform)
                return
              }

              if (dragStateRef.current) {
                const deltaX = point.x - dragStateRef.current.start.x
                const deltaY = point.y - dragStateRef.current.start.y

                if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
                  movedDuringGestureRef.current = true
                }

                const nextTransform = {
                  ...transformRef.current,
                  x: dragStateRef.current.transform.x + deltaX,
                  y: dragStateRef.current.transform.y + deltaY,
                }

                transformRef.current = nextTransform
                setTransform(nextTransform)
              }
            }}
            onPointerUp={(event) => {
              pointersRef.current.delete(event.pointerId)

              if (event.pointerType === 'touch' && pointersRef.current.size < 2) {
                pinchStateRef.current = null
              }

              dragStateRef.current = null
              window.setTimeout(() => {
                movedDuringGestureRef.current = false
              }, 0)
            }}
            onWheel={(event) => {
              if (!containerRef.current) {
                return
              }

              event.preventDefault()
              const point = getScreenPoint(containerRef.current, event.clientX, event.clientY)
              const scaleFactor = Math.exp(-event.deltaY * 0.0015)
              zoomAt(transformRef.current.scale * scaleFactor, point)
            }}
            ref={containerRef}
          >
            <svg
              className="absolute inset-0 h-full w-full"
              role="img"
              viewBox={`0 0 ${viewport.width || 1} ${viewport.height || 1}`}
            >
              <defs>
                {layout.nodes.map((node) => {
                  const avatarRadius = nodeSize.avatar / 2
                  const centerX = node.x + node.width / 2
                  const centerY = node.y + nodeSize.padding + avatarRadius

                  return (
                    <clipPath id={`avatar-clip-${node.person.id}`} key={`clip-${node.person.id}`}>
                      <circle cx={centerX} cy={centerY} r={avatarRadius} />
                    </clipPath>
                  )
                })}
              </defs>

              <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
                {layout.edges.map((edge) => (
                  <path
                    className="tree-line-draw"
                    d={makeConnectorPath(edge)}
                    fill="none"
                    key={edge.key}
                    opacity={0.4}
                    pathLength={1}
                    stroke="#7C4A2D"
                    strokeWidth={1.5}
                    style={{ animationDelay: `${lineAnimationDelay}ms` }}
                  />
                ))}

                {layout.marriages.map((marriage) => (
                  <g key={marriage.key}>
                    <line
                      className="tree-line-draw"
                      opacity={0.55}
                      pathLength={1}
                      stroke="#7C4A2D"
                      strokeLinecap="round"
                      strokeWidth={1.5}
                      style={{ animationDelay: `${lineAnimationDelay}ms` }}
                      x1={marriage.sourceX}
                      x2={marriage.targetX}
                      y1={marriage.sourceY}
                      y2={marriage.targetY}
                    />
                    <g transform={`translate(${marriage.midpointX - 5.5} ${marriage.midpointY - 11})`}>
                      <path
                        d="M5.5 10C3.6 8.5 1.3 6.8 0.4 4.7C-0.3 3.1 0.1 1.3 1.5 0.5C3 -0.4 4.6 0.2 5.5 1.5C6.4 0.2 8 -0.4 9.5 0.5C10.9 1.3 11.3 3.1 10.6 4.7C9.7 6.8 7.4 8.5 5.5 10Z"
                        fill="#C9943A"
                        stroke="#7C4A2D"
                        strokeWidth={0.7}
                      />
                    </g>
                  </g>
                ))}

                {layout.nodes.map((node) => {
                  const isSelected = selectedId === node.person.id
                  const fullName = getFullName(node.person)
                  const lines = splitNameLines(fullName, nodeSize.nameCharsPerLine)
                  const avatarRadius = nodeSize.avatar / 2
                  const avatarX = node.width / 2 - avatarRadius
                  const avatarY = nodeSize.padding
                  const hasLoadedImage = loadedNodeImages[node.person.id]
                  const isPulsing = activePulseId === node.person.id

                  return (
                    <g
                      aria-label={`Buka ${fullName}`}
                      className={`family-tree-node tree-node-enter cursor-pointer ${
                        isPulsing ? 'family-tree-node-pulse' : ''
                      }`}
                      key={node.person.id}
                      onClick={() => {
                        if (movedDuringGestureRef.current) {
                          return
                        }

                        navigate(`/person/${node.person.id}`)
                      }}
                      role="button"
                      tabIndex={0}
                      transform={`translate(${node.x} ${node.y})`}
                      style={{ animationDelay: `${node.generation * 80}ms` }}
                    >
                      <rect
                        className="family-tree-outline"
                        fill="none"
                        height={node.height + 4}
                        rx={22}
                        stroke="#5A7A4A"
                        strokeWidth={2.2}
                        width={node.width + 4}
                        x={-2}
                        y={-2}
                      />
                      <rect
                        fill="#FFF8F0"
                        height={node.height}
                        rx={20}
                        stroke={isSelected ? '#5A7A4A' : 'rgba(124,74,45,0.18)'}
                        strokeWidth={isSelected ? 2 : 1}
                        width={node.width}
                      />

                      {node.person.profileImageUrl ? (
                        <>
                          <image
                            clipPath={`url(#avatar-clip-${node.person.id})`}
                            height={nodeSize.avatar}
                            href={node.person.profileImageUrl}
                            onLoad={() =>
                              setLoadedNodeImages((current) => ({
                                ...current,
                                [node.person.id]: true,
                              }))
                            }
                            preserveAspectRatio="xMidYMid slice"
                            width={nodeSize.avatar}
                            x={avatarX}
                            y={avatarY}
                          />
                          {!hasLoadedImage ? (
                            <circle
                              className="skeleton-shimmer"
                              cx={node.width / 2}
                              cy={avatarY + avatarRadius}
                              fill="#EFE3D2"
                              r={avatarRadius}
                            />
                          ) : null}
                        </>
                      ) : (
                        <circle
                          cx={node.width / 2}
                          cy={avatarY + avatarRadius}
                          fill="#C9943A"
                          r={avatarRadius}
                        />
                      )}

                      {!node.person.profileImageUrl ? (
                        <text
                          fill="#FFF8F0"
                          fontFamily="Inter, sans-serif"
                          fontSize={Math.max(nodeSize.nameFontSize - 1, 9)}
                          fontWeight={700}
                          textAnchor="middle"
                          x={node.width / 2}
                          y={avatarY + avatarRadius + 4}
                        >
                          {getInitials(node.person)}
                        </text>
                      ) : null}

                      <text
                        fill="#7C4A2D"
                        fontFamily="Lora, serif"
                        fontSize={nodeSize.nameFontSize}
                        textAnchor="middle"
                        x={node.width / 2}
                        y={nodeSize.nameY}
                      >
                        {lines.map((line, index) => (
                          <tspan
                            dominantBaseline="middle"
                            key={`${node.person.id}-name-${index}`}
                            x={node.width / 2}
                            y={nodeSize.nameY + index * nodeSize.nameLineHeight}
                          >
                            {line}
                          </tspan>
                        ))}
                      </text>

                      <text
                        fill="rgba(124,74,45,0.6)"
                        fontFamily="Inter, sans-serif"
                        fontSize={nodeSize.birthFontSize}
                        textAnchor="middle"
                        x={node.width / 2}
                        y={nodeSize.birthY}
                      >
                        {getYearLabel(node.person.birthDate)}
                      </text>
                    </g>
                  )
                })}
              </g>
            </svg>

            <div className="pointer-events-none absolute bottom-4 right-4">
              <div className="overflow-hidden rounded-2xl border border-warm-brown/10 bg-white/90 shadow-[0_18px_35px_rgba(124,74,45,0.12)] backdrop-blur">
                <svg height={MINIMAP_HEIGHT} width={MINIMAP_WIDTH}>
                  <rect fill="#FFF8F0" height={MINIMAP_HEIGHT} width={MINIMAP_WIDTH} />
                  <g transform={`translate(${minimapOffsetX} ${minimapOffsetY}) scale(${minimapScale})`}>
                    {layout.edges.map((edge) => (
                      <path
                        d={makeConnectorPath(edge)}
                        fill="none"
                        key={`mini-${edge.key}`}
                        opacity={0.28}
                        stroke="#7C4A2D"
                        strokeWidth={2.2}
                      />
                    ))}
                    {layout.nodes.map((node) => (
                      <rect
                        fill={selectedId === node.person.id ? '#5A7A4A' : '#FFF8F0'}
                        height={node.height}
                        key={`mini-node-${node.person.id}`}
                        rx={18}
                        stroke="#7C4A2D"
                        strokeOpacity={0.2}
                        strokeWidth={1.6}
                        width={node.width}
                        x={node.x}
                        y={node.y}
                      />
                    ))}
                  </g>
                  <rect
                    fill="rgba(90,122,74,0.08)"
                    height={viewportRect.height}
                    rx={10}
                    stroke="#5A7A4A"
                    strokeWidth={1.5}
                    width={viewportRect.width}
                    x={viewportRect.x}
                    y={viewportRect.y}
                  />
                </svg>
              </div>
            </div>

            <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-warm-brown/10 bg-white/90 px-3 py-2 shadow-[0_18px_40px_rgba(124,74,45,0.14)] backdrop-blur lg:bottom-auto lg:left-4 lg:top-1/2 lg:flex-col lg:translate-x-0 lg:-translate-y-1/2 lg:rounded-[1.5rem] lg:px-2 lg:py-3">
              <ToolbarButton
                label="Zoom in"
                onClick={() =>
                  zoomAt(transform.scale * 1.2, {
                    x: viewport.width / 2,
                    y: viewport.height / 2,
                  })
                }
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle cx="10.5" cy="10.5" r="6.75" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M21 21L15.4 15.4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
                  <path d="M10.5 7.8V13.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
                  <path d="M7.8 10.5H13.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
                </svg>
              </ToolbarButton>
              <ToolbarButton
                label="Zoom out"
                onClick={() =>
                  zoomAt(transform.scale / 1.2, {
                    x: viewport.width / 2,
                    y: viewport.height / 2,
                  })
                }
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle cx="10.5" cy="10.5" r="6.75" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M21 21L15.4 15.4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
                  <path d="M7.8 10.5H13.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
                </svg>
              </ToolbarButton>
              <ToolbarButton
                label="Fit to screen"
                onClick={() => {
                  const nextTransform = fitTransform(layout.bounds, viewport)
                  setTransform(nextTransform)
                  transformRef.current = nextTransform
                }}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <path d="M4 9V4H9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
                  <path d="M15 4H20V9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
                  <path d="M20 15V20H15" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
                  <path d="M9 20H4V15" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
                </svg>
              </ToolbarButton>
              <ToolbarButton
                label="Center on me"
                onClick={() => centerOnNode(selectedId ?? layout.nodes[0]?.person.id)}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="4.25" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M12 2V5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
                  <path d="M12 19V22" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
                  <path d="M2 12H5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
                  <path d="M19 12H22" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
                </svg>
              </ToolbarButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
