import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, RotateCcw, CheckCircle2, CheckCheck, ChevronDown, ChevronRight, Pencil, X } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Trip, TripItem, Category } from '../../types'
import EditTripSheet from './EditTripSheet'
import SortableItem from '../ui/SortableItem'

interface GroupedItems {
  category: Category
  items: TripItem[]
}

function ProgressBar({ value, max, small }: { value: number; max: number; small?: boolean }) {
  const pct = max === 0 ? 100 : Math.round((value / max) * 100)
  const done = value === max && max > 0
  return (
    <div className={small ? '' : 'mt-1'}>
      <div className={`${small ? 'h-1' : 'h-2'} bg-gray-100 rounded-full overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${done ? 'bg-green-500' : 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function PackingView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [trip, setTrip] = useState<Trip | null>(null)
  const [groups, setGroups] = useState<GroupedItems[]>([])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [sheetItemId, setSheetItemId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const loadData = useCallback(async () => {
    if (!id) return

    const [{ data: tripData }, { data: itemData }] = await Promise.all([
      supabase
        .from('trips')
        .select('*, trip_type:trip_types(id, name, household_id)')
        .eq('id', id)
        .single(),
      supabase
        .from('trip_items')
        .select(`
          id, trip_id, item_id, quantity, packed, packed_by, packed_at,
          item:items(id, name, category_id, sort_order, household_id,
            category:categories(id, name, sort_order, household_id)
          )
        `)
        .eq('trip_id', id),
    ])

    if (!tripData || !itemData) { setLoading(false); return }

    setTrip(tripData as Trip)

    const categoryMap = new Map<string, { category: Category; items: TripItem[] }>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const ti of itemData as unknown as any[]) {
      const cat = (ti.item as any)?.category as Category | undefined
      if (!cat) continue
      if (!categoryMap.has(cat.id)) {
        categoryMap.set(cat.id, { category: cat, items: [] })
      }
      categoryMap.get(cat.id)!.items.push(ti)
    }

    const sorted = Array.from(categoryMap.values())
      .sort((a, b) => a.category.sort_order - b.category.sort_order)
      .map(g => ({
        ...g,
        // Sort items within category by trip_items.sort_order
        items: [...g.items].sort((a, b) => (a as any).sort_order - (b as any).sort_order),
      }))

    setGroups(sorted as GroupedItems[])
    setLoading(false)
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Realtime subscription
  useEffect(() => {
    if (!id) return

    const channel = supabase
      .channel(`trip-packing-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_items', filter: `trip_id=eq.${id}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as TripItem
            setGroups(prev =>
              prev.map(g => ({
                ...g,
                items: g.items.map(it =>
                  it.id === updated.id
                    ? {
                        ...it,
                        packed: updated.packed,
                        packed_count: updated.packed_count,
                        packed_by: updated.packed_by,
                        packed_at: updated.packed_at,
                      }
                    : it
                ),
              }))
            )
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  async function togglePacked(tripItem: TripItem) {
    // Einfacher Toggle für Menge = 1 (qty > 1 wird übers Sheet geregelt)
    const qty = tripItem.quantity
    const newPacked = !tripItem.packed
    const newCount = newPacked ? qty : 0
    const nowIso = new Date().toISOString()

    setGroups(prev =>
      prev.map(g => ({
        ...g,
        items: g.items.map(it =>
          it.id === tripItem.id
            ? {
                ...it,
                packed: newPacked,
                packed_count: newCount,
                packed_by: newPacked ? user?.id : undefined,
                packed_at: newPacked ? nowIso : undefined,
              }
            : it
        ),
      }))
    )

    await supabase
      .from('trip_items')
      .update({
        packed: newPacked,
        packed_count: newCount,
        packed_by: newPacked ? user?.id : null,
        packed_at: newPacked ? nowIso : null,
      })
      .eq('id', tripItem.id)
  }

  async function setPackedCount(tripItem: TripItem, rawCount: number) {
    const qty = tripItem.quantity
    const newCount = Math.max(0, Math.min(rawCount, qty))
    const newPacked = newCount >= qty && qty > 0
    const nowIso = new Date().toISOString()

    setGroups(prev =>
      prev.map(g => ({
        ...g,
        items: g.items.map(it =>
          it.id === tripItem.id
            ? {
                ...it,
                packed: newPacked,
                packed_count: newCount,
                packed_by: newCount > 0 ? user?.id : undefined,
                packed_at: newPacked ? nowIso : undefined,
              }
            : it
        ),
      }))
    )

    await supabase
      .from('trip_items')
      .update({
        packed: newPacked,
        packed_count: newCount,
        packed_by: newCount > 0 ? user?.id : null,
        packed_at: newPacked ? nowIso : null,
      })
      .eq('id', tripItem.id)
  }

  async function setPlannedQuantity(tripItem: TripItem, rawQty: number) {
    const newQty = Math.max(1, rawQty)
    const cappedCount = Math.min(tripItem.packed_count ?? 0, newQty)
    const newPacked = cappedCount >= newQty

    setGroups(prev =>
      prev.map(g => ({
        ...g,
        items: g.items.map(it =>
          it.id === tripItem.id
            ? {
                ...it,
                quantity: newQty,
                packed: newPacked,
                packed_count: cappedCount,
              }
            : it
        ),
      }))
    )

    await supabase
      .from('trip_items')
      .update({
        quantity: newQty,
        packed: newPacked,
        packed_count: cappedCount,
      })
      .eq('id', tripItem.id)
  }

  async function resetPacking() {
    if (!id) return
    setResetting(true)
    await supabase
      .from('trip_items')
      .update({ packed: false, packed_count: 0, packed_by: null, packed_at: null })
      .eq('trip_id', id)
    setGroups(prev =>
      prev.map(g => ({
        ...g,
        items: g.items.map(it => ({
          ...it,
          packed: false,
          packed_count: 0,
          packed_by: undefined,
          packed_at: undefined,
        })),
      }))
    )
    setResetting(false)
  }

  async function handleItemDragEnd(event: DragEndEvent, catId: string) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const groupIdx = groups.findIndex(g => g.category.id === catId)
    if (groupIdx === -1) return
    const items = groups[groupIdx].items
    const oldIdx = items.findIndex(i => i.id === active.id)
    const newIdx = items.findIndex(i => i.id === over.id)
    const reordered = arrayMove(items, oldIdx, newIdx)
    const newGroups = groups.map((g, i) => i === groupIdx ? { ...g, items: reordered } : g)
    setGroups(newGroups)
    await Promise.all(
      reordered.map((item, i) =>
        supabase.from('trip_items').update({ sort_order: i }).eq('id', item.id).then(() => {})
      )
    )
  }

  async function finishTrip() {
    if (!id) return
    setFinishing(true)
    await supabase.from('trips').update({ status: 'done' }).eq('id', id)
    navigate('/archive')
  }

  const allItems = groups.flatMap(g => g.items)
  const totalPacked = allItems.filter(i => i.packed).length
  const total = allItems.length
  const allDone = total > 0 && totalPacked === total

  const statusLabel: Record<string, string> = { planning: 'In Planung', packing: 'Packen', done: 'Abgeschlossen' }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">Reise nicht gefunden.</p>
        <button onClick={() => navigate('/')} className="text-blue-600">Zurück</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-safe sticky top-0 z-20">
        <div className="flex items-center gap-3 py-3">
          <button
            onClick={() => navigate('/')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 min-touch"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400">{statusLabel[trip.status]}</p>
            <h1 className="font-bold text-gray-900 truncate">{trip.name}</h1>
          </div>
          {trip.status === 'packing' && (
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(true)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 min-touch"
                title="Packliste bearbeiten"
              >
                <Pencil size={18} className="text-gray-600" />
              </button>
              <button
                onClick={resetPacking}
                disabled={resetting || totalPacked === 0}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 min-touch disabled:opacity-40"
                title="Alle zurücksetzen"
              >
                {resetting
                  ? <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                  : <RotateCcw size={18} className="text-gray-600" />
                }
              </button>
            </div>
          )}
        </div>

        {/* Overall progress */}
        <div className="pb-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-gray-700">{totalPacked} von {total} gepackt</span>
            <span className={`font-semibold ${allDone ? 'text-green-600' : 'text-blue-600'}`}>
              {total === 0 ? '–' : `${Math.round((totalPacked / total) * 100)}%`}
            </span>
          </div>
          <ProgressBar value={totalPacked} max={total} />
        </div>
      </div>

      {/* Category groups */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-32">
        {groups.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>Keine Artikel geplant.</p>
          </div>
        )}

        {groups.map(({ category, items }) => {
          const catPacked = items.filter(i => i.packed).length
          const catTotal = items.length
          const catDone = catPacked === catTotal && catTotal > 0
          const isCollapsed = collapsed[category.id]

          return (
            <div key={category.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <button
                onClick={() => setCollapsed(prev => ({ ...prev, [category.id]: !prev[category.id] }))}
                className="w-full flex items-center gap-3 px-4 py-3 text-left min-touch"
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-800">{category.name}</span>
                    <span className={`text-xs font-medium ${catDone ? 'text-green-600' : 'text-gray-400'}`}>
                      {catPacked}/{catTotal}
                    </span>
                  </div>
                  <ProgressBar value={catPacked} max={catTotal} small />
                </div>
                <div className="ml-2">
                  {isCollapsed
                    ? <ChevronRight size={18} className="text-gray-300" />
                    : <ChevronDown size={18} className="text-gray-300" />
                  }
                </div>
              </button>

              {!isCollapsed && (
                <div className="border-t border-gray-50">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={e => handleItemDragEnd(e, category.id)}
                  >
                    <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                      {items.map(item => {
                        const count = item.packed_count ?? (item.packed ? item.quantity : 0)
                        const isFull = item.packed
                        const isPartial = !isFull && count > 0
                        const hasMultiple = item.quantity > 1
                        return (
                        <SortableItem key={item.id} id={item.id}>
                          {(handle) => (
                            <div className={`flex items-center border-b border-gray-50 last:border-b-0 transition-colors ${
                              isFull ? 'bg-green-50' : isPartial ? 'bg-amber-50' : ''
                            }`}>
                              {trip.status === 'packing' && handle}
                              <button
                                onClick={() => {
                                  if (trip.status === 'done') return
                                  if (hasMultiple) setSheetItemId(item.id)
                                  else togglePacked(item)
                                }}
                                disabled={trip.status === 'done'}
                                className="flex-1 flex items-center gap-3 px-3 py-3.5 text-left active:bg-gray-50"
                              >
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                  isFull
                                    ? 'bg-green-500 border-green-500'
                                    : isPartial
                                      ? 'bg-amber-400 border-amber-400'
                                      : 'border-gray-300'
                                }`}>
                                  {isFull && <CheckCircle2 size={14} className="text-white" strokeWidth={2.5} />}
                                  {isPartial && (
                                    <span className="text-[10px] font-bold text-white leading-none">{count}</span>
                                  )}
                                </div>
                                <span className={`flex-1 text-sm font-medium transition-colors ${
                                  isFull ? 'line-through text-gray-400' : 'text-gray-700'
                                }`}>
                                  {(item.item as any)?.name ?? ''}
                                </span>
                                {item.quantity > 1 && (
                                  <span className={`text-xs font-medium ${
                                    isFull
                                      ? 'text-gray-300'
                                      : isPartial
                                        ? 'text-amber-600'
                                        : 'text-gray-400'
                                  }`}>
                                    {isPartial ? `${count}/${item.quantity}` : `×${item.quantity}`}
                                  </span>
                                )}
                              </button>
                            </div>
                          )}
                        </SortableItem>
                        )
                      })}
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer action */}
      {trip.status === 'packing' && (
        <div
          className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 max-w-md mx-auto"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={finishTrip}
            disabled={finishing || !allDone}
            className={`w-full font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors ${
              allDone
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            {finishing ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 size={20} />
                {allDone ? 'Reise abschließen' : `Noch ${total - totalPacked} Artikel offen`}
              </>
            )}
          </button>
        </div>
      )}

      {trip.status === 'done' && (
        <div
          className="fixed bottom-0 left-0 right-0 bg-green-50 border-t border-green-100 px-4 py-4 max-w-md mx-auto text-center"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <p className="text-green-700 font-medium">Reise abgeschlossen</p>
          <button onClick={() => navigate('/archive')} className="text-green-600 text-sm mt-1">
            Im Archiv ansehen
          </button>
        </div>
      )}

      {sheetItemId && (() => {
        const item = allItems.find(i => i.id === sheetItemId)
        if (!item) return null
        const count = item.packed_count ?? (item.packed ? item.quantity : 0)
        const name = (item.item as any)?.name ?? ''

        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={() => setSheetItemId(null)}>
            <div
              className="bg-white w-full max-w-md rounded-t-3xl px-5 pt-5"
              style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-medium">Artikel</p>
                  <h3 className="font-semibold text-gray-900 truncate">{name}</h3>
                </div>
                <button
                  onClick={() => setSheetItemId(null)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 flex-shrink-0"
                >
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              {/* Alle gepackt */}
              <button
                onClick={() => { setPackedCount(item, item.quantity); setSheetItemId(null) }}
                disabled={count >= item.quantity}
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-3.5 rounded-xl mb-5 disabled:opacity-40"
              >
                <CheckCheck size={18} />
                Alle {item.quantity} gepackt
              </button>

              {/* Eingepackt */}
              <div className="bg-gray-50 rounded-2xl p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Eingepackt</p>
                    <p className="text-lg font-bold text-gray-900">
                      {count} <span className="text-gray-400 font-medium">/ {item.quantity}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPackedCount(item, count - 1)}
                      disabled={count <= 0}
                      className="w-11 h-11 rounded-xl bg-white border border-gray-200 flex items-center justify-center font-bold text-xl text-gray-700 disabled:opacity-30"
                    >
                      −
                    </button>
                    <button
                      onClick={() => setPackedCount(item, count + 1)}
                      disabled={count >= item.quantity}
                      className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
                {count > 0 && (
                  <button
                    onClick={() => setPackedCount(item, 0)}
                    className="text-xs text-gray-500 font-medium"
                  >
                    Zurücksetzen
                  </button>
                )}
              </div>

              {/* Geplante Anzahl */}
              <div className="bg-gray-50 rounded-2xl p-4 mb-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Geplante Anzahl</p>
                    <p className="text-lg font-bold text-gray-900">{item.quantity}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPlannedQuantity(item, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="w-11 h-11 rounded-xl bg-white border border-gray-200 flex items-center justify-center font-bold text-xl text-gray-700 disabled:opacity-30"
                    >
                      −
                    </button>
                    <button
                      onClick={() => setPlannedQuantity(item, item.quantity + 1)}
                      className="w-11 h-11 rounded-xl bg-white border border-gray-200 flex items-center justify-center font-bold text-xl text-gray-700"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSheetItemId(null)}
                className="w-full bg-gray-100 text-gray-700 font-semibold py-3.5 rounded-xl"
              >
                Fertig
              </button>
            </div>
          </div>
        )
      })()}

      {editing && id && (
        <EditTripSheet
          tripId={id}
          currentTripItems={allItems}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); loadData() }}
        />
      )}
    </div>
  )
}
