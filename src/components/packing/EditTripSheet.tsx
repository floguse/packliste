import { useEffect, useState } from 'react'
import { X, Plus, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useHousehold } from '../../contexts/HouseholdContext'
import { Category, Item, TripItem } from '../../types'

interface ItemSelection {
  selected: boolean
  quantity: number
}

interface Props {
  tripId: string
  currentTripItems: TripItem[]
  onClose: () => void
  onSaved: () => void
}

export default function EditTripSheet({ tripId, currentTripItems, onClose, onSaved }: Props) {
  const { household } = useHousehold()

  const [categories, setCategories] = useState<Category[]>([])
  const [itemsByCategory, setItemsByCategory] = useState<Record<string, Item[]>>({})
  const [selections, setSelections] = useState<Record<string, ItemSelection>>({})
  const [activeTab, setActiveTab] = useState('')
  const [newItemNames, setNewItemNames] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [loadedCats, setLoadedCats] = useState<Set<string>>(new Set())

  // Initialise selections from current trip items
  useEffect(() => {
    const initial: Record<string, ItemSelection> = {}
    for (const ti of currentTripItems) {
      initial[ti.item_id] = { selected: true, quantity: ti.quantity }
    }
    setSelections(initial)
  }, [currentTripItems])

  // Load all categories for the household
  useEffect(() => {
    if (!household) return
    supabase
      .from('categories')
      .select('*')
      .eq('household_id', household.id)
      .order('sort_order')
      .then(({ data }) => {
        setCategories(data ?? [])
        if (data && data.length > 0) setActiveTab(data[0].id)
      })
  }, [household])

  // Lazy-load items for a category when switching to it
  useEffect(() => {
    if (!activeTab || !household || loadedCats.has(activeTab)) return
    supabase
      .from('items')
      .select('*')
      .eq('category_id', activeTab)
      .eq('household_id', household.id)
      .order('sort_order')
      .then(({ data }) => {
        setItemsByCategory(prev => ({ ...prev, [activeTab]: data ?? [] }))
        setLoadedCats(prev => new Set(prev).add(activeTab))
      })
  }, [activeTab, household, loadedCats])

  function toggleItem(itemId: string) {
    setSelections(prev => ({
      ...prev,
      [itemId]: {
        selected: !prev[itemId]?.selected,
        quantity: prev[itemId]?.quantity ?? 1,
      },
    }))
  }

  function setQty(itemId: string, qty: number) {
    setSelections(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? { selected: true }), quantity: Math.max(1, qty) },
    }))
  }

  async function addItem(catId: string) {
    const name = newItemNames[catId]?.trim()
    if (!name || !household) return
    const existing = itemsByCategory[catId] ?? []
    const maxOrder = Math.max(0, ...existing.map(i => i.sort_order))
    const { data } = await supabase
      .from('items')
      .insert({ household_id: household.id, category_id: catId, name, sort_order: maxOrder + 1 })
      .select()
      .single()
    if (data) {
      setItemsByCategory(prev => ({ ...prev, [catId]: [...(prev[catId] ?? []), data] }))
      setSelections(prev => ({ ...prev, [data.id]: { selected: true, quantity: 1 } }))
    }
    setNewItemNames(prev => ({ ...prev, [catId]: '' }))
  }

  async function saveChanges() {
    setSaving(true)

    const currentMap = new Map(currentTripItems.map(ti => [ti.item_id, ti]))
    const toInsert: { trip_id: string; item_id: string; quantity: number; packed: boolean }[] = []
    const toUpdate: { id: string; quantity: number }[] = []
    const toDeleteIds: string[] = []

    for (const [itemId, sel] of Object.entries(selections)) {
      const existing = currentMap.get(itemId)
      if (sel.selected && !existing) {
        toInsert.push({ trip_id: tripId, item_id: itemId, quantity: sel.quantity, packed: false })
      } else if (sel.selected && existing && existing.quantity !== sel.quantity) {
        toUpdate.push({ id: existing.id, quantity: sel.quantity })
      } else if (!sel.selected && existing) {
        toDeleteIds.push(existing.id)
      }
    }

    await Promise.all([
      toInsert.length > 0
        ? supabase.from('trip_items').insert(toInsert).then(() => {})
        : Promise.resolve(),
      ...toUpdate.map(({ id, quantity }) =>
        supabase.from('trip_items').update({ quantity }).eq('id', id).then(() => {})
      ),
      toDeleteIds.length > 0
        ? supabase.from('trip_items').delete().in('id', toDeleteIds).then(() => {})
        : Promise.resolve(),
    ])

    setSaving(false)
    onSaved()
  }

  const selectedCount = Object.values(selections).filter(s => s.selected).length

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-safe">
        <div className="flex items-center gap-3 py-4">
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 min-touch"
          >
            <X size={20} className="text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-gray-900">Packliste bearbeiten</h1>
            <p className="text-xs text-gray-400">{selectedCount} Artikel ausgewählt</p>
          </div>
        </div>

        {/* Category tabs */}
        <div className="overflow-x-auto pb-3">
          <div className="flex gap-1.5 min-w-max">
            {categories.map(cat => {
              const catItems = itemsByCategory[cat.id] ?? []
              const selCount = catItems.filter(it => selections[it.id]?.selected).length
              const isActive = activeTab === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors min-touch ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {cat.name}
                  {selCount > 0 && (
                    <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${
                      isActive ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {selCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 pb-32">
        {!loadedCats.has(activeTab) && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {(itemsByCategory[activeTab] ?? []).map(item => {
          const sel = selections[item.id]
          const isSelected = sel?.selected ?? false
          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'
              }`}
            >
              <button
                onClick={() => toggleItem(item.id)}
                className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                }`}
              >
                {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
              </button>
              <span className={`flex-1 text-sm font-medium ${isSelected ? 'text-blue-800' : 'text-gray-600'}`}>
                {item.name}
              </span>
              {isSelected && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setQty(item.id, (sel?.quantity ?? 1) - 1)}
                    className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg leading-none"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-blue-800">
                    {sel?.quantity ?? 1}
                  </span>
                  <button
                    onClick={() => setQty(item.id, (sel?.quantity ?? 1) + 1)}
                    className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg leading-none"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {/* Add new item inline */}
        {loadedCats.has(activeTab) && (
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              value={newItemNames[activeTab] ?? ''}
              onChange={e => setNewItemNames(prev => ({ ...prev, [activeTab]: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addItem(activeTab)}
              placeholder="Neuer Artikel hinzufügen…"
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <button
              onClick={() => addItem(activeTab)}
              disabled={!newItemNames[activeTab]?.trim()}
              className="w-11 h-11 bg-gray-100 rounded-xl flex items-center justify-center disabled:opacity-40"
            >
              <Plus size={18} className="text-gray-600" />
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 max-w-md mx-auto"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={saveChanges}
          disabled={saving}
          className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Check size={20} />
              Änderungen speichern
            </>
          )}
        </button>
      </div>
    </div>
  )
}
