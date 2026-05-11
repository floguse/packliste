import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Plus, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useHousehold } from '../../contexts/HouseholdContext'
import { useAuth } from '../../contexts/AuthContext'
import { TripType, Category, Item } from '../../types'

interface ItemSelection {
  itemId: string
  quantity: number
  selected: boolean
}

const TOTAL_STEPS = 4

export default function PlanningWizard() {
  const navigate = useNavigate()
  const { household } = useHousehold()
  const { user } = useAuth()

  const [step, setStep] = useState(1)
  const [tripName, setTripName] = useState('')
  const [tripTypeId, setTripTypeId] = useState('')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [selections, setSelections] = useState<Record<string, ItemSelection>>({})
  const [activeCategoryTab, setActiveCategoryTab] = useState('')

  const [tripTypes, setTripTypes] = useState<TripType[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [itemsByCategory, setItemsByCategory] = useState<Record<string, Item[]>>({})

  const [saving, setSaving] = useState(false)
  const [newTripTypeName, setNewTripTypeName] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newItemNames, setNewItemNames] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!household) return
    Promise.all([
      supabase.from('trip_types').select('*').eq('household_id', household.id).order('name'),
      supabase.from('categories').select('*').eq('household_id', household.id).order('sort_order'),
    ]).then(([{ data: tt }, { data: cats }]) => {
      setTripTypes(tt ?? [])
      setCategories(cats ?? [])
    })
  }, [household])

  useEffect(() => {
    if (selectedCategoryIds.length === 0 || !household) return
    const missing = selectedCategoryIds.filter(id => !itemsByCategory[id])
    if (missing.length === 0) return

    Promise.all(
      missing.map(catId =>
        supabase
          .from('items')
          .select('*')
          .eq('category_id', catId)
          .eq('household_id', household.id)
          .order('sort_order')
      )
    ).then(results => {
      const newMap: Record<string, Item[]> = { ...itemsByCategory }
      missing.forEach((catId, i) => { newMap[catId] = results[i].data ?? [] })
      setItemsByCategory(newMap)
    })
  }, [selectedCategoryIds, household])

  useEffect(() => {
    if (activeCategoryTab === '' && selectedCategoryIds.length > 0) {
      setActiveCategoryTab(selectedCategoryIds[0])
    }
  }, [selectedCategoryIds, activeCategoryTab])

  async function addTripType() {
    if (!newTripTypeName.trim() || !household) return
    const { data } = await supabase
      .from('trip_types')
      .insert({ household_id: household.id, name: newTripTypeName.trim() })
      .select()
      .single()
    if (data) { setTripTypes(prev => [...prev, data]); setTripTypeId(data.id) }
    setNewTripTypeName('')
  }

  async function addCategory() {
    if (!newCategoryName.trim() || !household) return
    const maxOrder = Math.max(0, ...categories.map(c => c.sort_order))
    const { data } = await supabase
      .from('categories')
      .insert({ household_id: household.id, name: newCategoryName.trim(), sort_order: maxOrder + 1 })
      .select()
      .single()
    if (data) {
      setCategories(prev => [...prev, data])
      setSelectedCategoryIds(prev => [...prev, data.id])
    }
    setNewCategoryName('')
  }

  async function addItemToCategory(catId: string) {
    const name = newItemNames[catId]?.trim()
    if (!name || !household) return
    const currentItems = itemsByCategory[catId] ?? []
    const maxOrder = Math.max(0, ...currentItems.map(i => i.sort_order))
    const { data } = await supabase
      .from('items')
      .insert({ household_id: household.id, category_id: catId, name, sort_order: maxOrder + 1 })
      .select()
      .single()
    if (data) {
      setItemsByCategory(prev => ({ ...prev, [catId]: [...(prev[catId] ?? []), data] }))
      setSelections(prev => ({ ...prev, [data.id]: { itemId: data.id, quantity: 1, selected: true } }))
    }
    setNewItemNames(prev => ({ ...prev, [catId]: '' }))
  }

  function toggleItem(itemId: string) {
    setSelections(prev => ({
      ...prev,
      [itemId]: {
        itemId,
        quantity: prev[itemId]?.quantity ?? 1,
        selected: !prev[itemId]?.selected,
      },
    }))
  }

  function setQty(itemId: string, qty: number) {
    setSelections(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? { itemId, selected: true }), quantity: Math.max(1, qty) },
    }))
  }

  async function finalize() {
    if (!household || !user) return
    setSaving(true)

    const { data: trip, error } = await supabase
      .from('trips')
      .insert({
        household_id: household.id,
        name: tripName.trim(),
        trip_type_id: tripTypeId || null,
        status: 'packing',
        created_by: user.id,
      })
      .select()
      .single()

    if (error || !trip) { setSaving(false); return }

    const selectedItems = Object.values(selections).filter(s => s.selected)
    if (selectedItems.length > 0) {
      await supabase.from('trip_items').insert(
        selectedItems.map(s => ({
          trip_id: trip.id,
          item_id: s.itemId,
          quantity: s.quantity,
          packed: false,
        }))
      )
    }

    navigate(`/trip/${trip.id}`)
  }

  const canProceedStep1 = tripName.trim().length > 0
  const canProceedStep2 = selectedCategoryIds.length > 0
  const selectedCount = Object.values(selections).filter(s => s.selected).length

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-safe">
        <div className="flex items-center gap-3 py-4">
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 min-touch"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div className="flex-1">
            <p className="text-xs text-gray-400 font-medium">Schritt {step} von {TOTAL_STEPS}</p>
            <h1 className="font-semibold text-gray-900">
              {step === 1 && 'Reisedetails'}
              {step === 2 && 'Kategorien wählen'}
              {step === 3 && 'Artikel auswählen'}
              {step === 4 && 'Zusammenfassung'}
            </h1>
          </div>
          <button onClick={() => navigate('/')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 min-touch">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        {/* Progress bar */}
        <div className="flex gap-1.5 pb-4">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${i < step ? 'bg-blue-600' : 'bg-gray-100'}`}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* Step 1: Trip name + type */}
        {step === 1 && (
          <div className="px-4 py-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reisename</label>
              <input
                type="text"
                value={tripName}
                onChange={e => setTripName(e.target.value)}
                placeholder="z.B. Sommerurlaub Mallorca"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reisetyp (optional)</label>
              <div className="flex flex-wrap gap-2">
                {tripTypes.map(tt => (
                  <button
                    key={tt.id}
                    onClick={() => setTripTypeId(prev => prev === tt.id ? '' : tt.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors min-touch ${
                      tripTypeId === tt.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-200'
                    }`}
                  >
                    {tt.name}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={newTripTypeName}
                  onChange={e => setNewTripTypeName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTripType()}
                  placeholder="Neuer Reisetyp"
                  className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  onClick={addTripType}
                  disabled={!newTripTypeName.trim()}
                  className="w-11 h-11 bg-gray-100 rounded-xl flex items-center justify-center disabled:opacity-40"
                >
                  <Plus size={18} className="text-gray-600" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Category selection */}
        {step === 2 && (
          <div className="px-4 py-6 space-y-3">
            <p className="text-sm text-gray-500">Wähle die Kategorien, die du für diese Reise benötigst.</p>
            {categories.map(cat => {
              const selected = selectedCategoryIds.includes(cat.id)
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategoryIds(prev =>
                      selected ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                    )
                    if (!selected && activeCategoryTab === '') setActiveCategoryTab(cat.id)
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-left transition-colors min-touch ${
                    selected ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-white border-gray-200 text-gray-700'
                  }`}
                >
                  <span className="font-medium">{cat.name}</span>
                  {selected && <Check size={18} className="text-blue-600" />}
                </button>
              )
            })}
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCategory()}
                placeholder="Neue Kategorie"
                className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                onClick={addCategory}
                disabled={!newCategoryName.trim()}
                className="w-11 h-11 bg-gray-100 rounded-xl flex items-center justify-center disabled:opacity-40"
              >
                <Plus size={18} className="text-gray-600" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Item selection per category */}
        {step === 3 && (
          <div className="flex flex-col h-full">
            {/* Category tabs */}
            <div className="bg-white border-b border-gray-100 overflow-x-auto">
              <div className="flex px-4 gap-1 py-2 min-w-max">
                {selectedCategoryIds.map(catId => {
                  const cat = categories.find(c => c.id === catId)
                  if (!cat) return null
                  const catItems = itemsByCategory[catId] ?? []
                  const selCount = catItems.filter(it => selections[it.id]?.selected).length
                  return (
                    <button
                      key={catId}
                      onClick={() => setActiveCategoryTab(catId)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                        activeCategoryTab === catId
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {cat.name}
                      {selCount > 0 && (
                        <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${
                          activeCategoryTab === catId ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {selCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="px-4 py-4 space-y-2 flex-1 overflow-y-auto">
              {(itemsByCategory[activeCategoryTab] ?? []).map(item => {
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
                    <span className={`flex-1 text-sm font-medium ${isSelected ? 'text-blue-800' : 'text-gray-700'}`}>
                      {item.name}
                    </span>
                    {isSelected && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setQty(item.id, (sel?.quantity ?? 1) - 1)}
                          className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-semibold text-blue-800">
                          {sel?.quantity ?? 1}
                        </span>
                        <button
                          onClick={() => setQty(item.id, (sel?.quantity ?? 1) + 1)}
                          className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}

              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={newItemNames[activeCategoryTab] ?? ''}
                  onChange={e => setNewItemNames(prev => ({ ...prev, [activeCategoryTab]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addItemToCategory(activeCategoryTab)}
                  placeholder="Neuer Artikel"
                  className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  onClick={() => addItemToCategory(activeCategoryTab)}
                  disabled={!newItemNames[activeCategoryTab]?.trim()}
                  className="w-11 h-11 bg-gray-100 rounded-xl flex items-center justify-center disabled:opacity-40"
                >
                  <Plus size={18} className="text-gray-600" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Summary */}
        {step === 4 && (
          <div className="px-4 py-6 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-gray-400 mb-1">Reisename</p>
              <p className="font-semibold text-gray-900">{tripName}</p>
              {tripTypeId && (
                <p className="text-sm text-gray-500 mt-1">{tripTypes.find(t => t.id === tripTypeId)?.name}</p>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-gray-400 mb-3">{selectedCount} Artikel in {selectedCategoryIds.length} Kategorien</p>
              <div className="space-y-4">
                {selectedCategoryIds.map(catId => {
                  const cat = categories.find(c => c.id === catId)
                  const catItems = (itemsByCategory[catId] ?? []).filter(it => selections[it.id]?.selected)
                  if (catItems.length === 0) return null
                  return (
                    <div key={catId}>
                      <p className="text-sm font-semibold text-gray-700 mb-2">{cat?.name}</p>
                      <div className="space-y-1">
                        {catItems.map(item => (
                          <div key={item.id} className="flex items-center justify-between text-sm text-gray-600">
                            <span>{item.name}</span>
                            <span className="text-gray-400">×{selections[item.id]?.quantity ?? 1}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="bg-white border-t border-gray-100 px-4 py-3"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        {step < 4 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={
              (step === 1 && !canProceedStep1) ||
              (step === 2 && !canProceedStep2)
            }
            className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40"
          >
            Weiter
            <ArrowRight size={18} />
          </button>
        ) : (
          <button
            onClick={finalize}
            disabled={saving || selectedCount === 0}
            className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Check size={20} />
                Reise erstellen & packen
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
