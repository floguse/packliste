import { useEffect, useState } from 'react'
import {
  LogOut, Plus, Trash2, Edit2, Check, X, Users, Tag, Layers, ChevronDown, ChevronRight,
  Copy, Link
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { Category, Item, TripType } from '../types'

type Tab = 'categories' | 'triptypes' | 'household'

function InlineEdit({
  value, onSave, onCancel,
}: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(value)
  return (
    <div className="flex items-center gap-2 flex-1">
      <input
        type="text"
        value={v}
        onChange={e => setV(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSave(v); if (e.key === 'Escape') onCancel() }}
        className="flex-1 px-3 py-1.5 rounded-lg border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
        autoFocus
      />
      <button onClick={() => onSave(v)} className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
        <Check size={14} className="text-green-600" />
      </button>
      <button onClick={onCancel} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
        <X size={14} className="text-gray-500" />
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const { signOut, user } = useAuth()
  const { household, members, removeMember, generateInviteLink } = useHousehold()

  const [tab, setTab] = useState<Tab>('categories')
  const [categories, setCategories] = useState<Category[]>([])
  const [itemsByCategory, setItemsByCategory] = useState<Record<string, Item[]>>({})
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({})
  const [tripTypes, setTripTypes] = useState<TripType[]>([])

  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingTTId, setEditingTTId] = useState<string | null>(null)

  const [newCatName, setNewCatName] = useState('')
  const [newItemNames, setNewItemNames] = useState<Record<string, string>>({})
  const [newTTName, setNewTTName] = useState('')

  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!household) return
    Promise.all([
      supabase.from('categories').select('*').eq('household_id', household.id).order('sort_order'),
      supabase.from('trip_types').select('*').eq('household_id', household.id).order('name'),
    ]).then(([{ data: cats }, { data: tt }]) => {
      setCategories(cats ?? [])
      setTripTypes(tt ?? [])
      setLoading(false)
    })
  }, [household])

  async function loadCategoryItems(catId: string) {
    if (itemsByCategory[catId]) return
    const { data } = await supabase
      .from('items')
      .select('*')
      .eq('category_id', catId)
      .order('sort_order')
    setItemsByCategory(prev => ({ ...prev, [catId]: data ?? [] }))
  }

  function toggleCat(catId: string) {
    const nowExpanded = !expandedCats[catId]
    setExpandedCats(prev => ({ ...prev, [catId]: nowExpanded }))
    if (nowExpanded) loadCategoryItems(catId)
  }

  // Category CRUD
  async function addCategory() {
    if (!newCatName.trim() || !household) return
    const maxOrder = Math.max(0, ...categories.map(c => c.sort_order))
    const { data } = await supabase
      .from('categories')
      .insert({ household_id: household.id, name: newCatName.trim(), sort_order: maxOrder + 1 })
      .select().single()
    if (data) setCategories(prev => [...prev, data])
    setNewCatName('')
  }

  async function renameCategory(id: string, name: string) {
    if (!name.trim()) return setEditingCatId(null)
    await supabase.from('categories').update({ name: name.trim() }).eq('id', id)
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name: name.trim() } : c))
    setEditingCatId(null)
  }

  async function deleteCategory(id: string) {
    if (!confirm('Kategorie und alle Artikel löschen?')) return
    await supabase.from('categories').delete().eq('id', id)
    setCategories(prev => prev.filter(c => c.id !== id))
    setItemsByCategory(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  // Item CRUD
  async function addItem(catId: string) {
    const name = newItemNames[catId]?.trim()
    if (!name || !household) return
    const currentItems = itemsByCategory[catId] ?? []
    const maxOrder = Math.max(0, ...currentItems.map(i => i.sort_order))
    const { data } = await supabase
      .from('items')
      .insert({ household_id: household.id, category_id: catId, name, sort_order: maxOrder + 1 })
      .select().single()
    if (data) setItemsByCategory(prev => ({ ...prev, [catId]: [...(prev[catId] ?? []), data] }))
    setNewItemNames(prev => ({ ...prev, [catId]: '' }))
  }

  async function renameItem(id: string, catId: string, name: string) {
    if (!name.trim()) return setEditingItemId(null)
    await supabase.from('items').update({ name: name.trim() }).eq('id', id)
    setItemsByCategory(prev => ({
      ...prev,
      [catId]: (prev[catId] ?? []).map(it => it.id === id ? { ...it, name: name.trim() } : it),
    }))
    setEditingItemId(null)
  }

  async function deleteItem(id: string, catId: string) {
    await supabase.from('items').delete().eq('id', id)
    setItemsByCategory(prev => ({ ...prev, [catId]: (prev[catId] ?? []).filter(it => it.id !== id) }))
  }

  // Trip type CRUD
  async function addTripType() {
    if (!newTTName.trim() || !household) return
    const { data } = await supabase
      .from('trip_types')
      .insert({ household_id: household.id, name: newTTName.trim() })
      .select().single()
    if (data) setTripTypes(prev => [...prev, data])
    setNewTTName('')
  }

  async function renameTripType(id: string, name: string) {
    if (!name.trim()) return setEditingTTId(null)
    await supabase.from('trip_types').update({ name: name.trim() }).eq('id', id)
    setTripTypes(prev => prev.map(t => t.id === id ? { ...t, name: name.trim() } : t))
    setEditingTTId(null)
  }

  async function deleteTripType(id: string) {
    await supabase.from('trip_types').delete().eq('id', id)
    setTripTypes(prev => prev.filter(t => t.id !== id))
  }

  // Household
  async function handleGenerateLink() {
    setInviteLoading(true)
    const { link, error } = await generateInviteLink()
    if (link) setInviteLink(link)
    else alert(error)
    setInviteLoading(false)
  }

  async function copyLink() {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const myRole = members.find(m => m.user_id === user?.id)?.role

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'categories', label: 'Kategorien', icon: <Layers size={16} /> },
    { key: 'triptypes', label: 'Reisetypen', icon: <Tag size={16} /> },
    { key: 'household', label: 'Haushalt', icon: <Users size={16} /> },
  ]

  return (
    <div className="px-4 pt-8 pb-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Einstellungen</h1>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5 bg-gray-100 p-1 rounded-xl">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors min-touch ${
              tab === t.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-12"><div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}

      {/* Categories tab */}
      {!loading && tab === 'categories' && (
        <div className="space-y-2">
          {categories.map(cat => (
            <div key={cat.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3">
                {editingCatId === cat.id ? (
                  <InlineEdit
                    value={cat.name}
                    onSave={v => renameCategory(cat.id, v)}
                    onCancel={() => setEditingCatId(null)}
                  />
                ) : (
                  <>
                    <button
                      onClick={() => toggleCat(cat.id)}
                      className="flex-1 flex items-center gap-2 text-left min-touch"
                    >
                      {expandedCats[cat.id]
                        ? <ChevronDown size={16} className="text-gray-400" />
                        : <ChevronRight size={16} className="text-gray-400" />
                      }
                      <span className="font-semibold text-gray-800">{cat.name}</span>
                    </button>
                    <button onClick={() => setEditingCatId(cat.id)} className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                      <Edit2 size={14} className="text-gray-400" />
                    </button>
                    <button onClick={() => deleteCategory(cat.id)} className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </>
                )}
              </div>

              {expandedCats[cat.id] && (
                <div className="border-t border-gray-50 px-4 py-2">
                  <div className="space-y-1 mb-2">
                    {(itemsByCategory[cat.id] ?? []).map(item => (
                      <div key={item.id} className="flex items-center gap-2 py-1.5">
                        {editingItemId === item.id ? (
                          <InlineEdit
                            value={item.name}
                            onSave={v => renameItem(item.id, cat.id, v)}
                            onCancel={() => setEditingItemId(null)}
                          />
                        ) : (
                          <>
                            <span className="flex-1 text-sm text-gray-600 pl-1">{item.name}</span>
                            <button onClick={() => setEditingItemId(item.id)} className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center">
                              <Edit2 size={12} className="text-gray-400" />
                            </button>
                            <button onClick={() => deleteItem(item.id, cat.id)} className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                              <Trash2 size={12} className="text-red-400" />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newItemNames[cat.id] ?? ''}
                      onChange={e => setNewItemNames(prev => ({ ...prev, [cat.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addItem(cat.id)}
                      placeholder="Neuer Artikel"
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <button
                      onClick={() => addItem(cat.id)}
                      disabled={!newItemNames[cat.id]?.trim()}
                      className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center disabled:opacity-40"
                    >
                      <Plus size={16} className="text-blue-600" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCategory()}
              placeholder="Neue Kategorie"
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addCategory}
              disabled={!newCatName.trim()}
              className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center disabled:opacity-40"
            >
              <Plus size={20} className="text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Trip types tab */}
      {!loading && tab === 'triptypes' && (
        <div className="space-y-2">
          {tripTypes.map(tt => (
            <div key={tt.id} className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center gap-2">
              {editingTTId === tt.id ? (
                <InlineEdit
                  value={tt.name}
                  onSave={v => renameTripType(tt.id, v)}
                  onCancel={() => setEditingTTId(null)}
                />
              ) : (
                <>
                  <span className="flex-1 font-medium text-gray-800">{tt.name}</span>
                  <button onClick={() => setEditingTTId(tt.id)} className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                    <Edit2 size={14} className="text-gray-400" />
                  </button>
                  <button onClick={() => deleteTripType(tt.id)} className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </>
              )}
            </div>
          ))}

          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={newTTName}
              onChange={e => setNewTTName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTripType()}
              placeholder="Neuer Reisetyp"
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addTripType}
              disabled={!newTTName.trim()}
              className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center disabled:opacity-40"
            >
              <Plus size={20} className="text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Household tab */}
      {!loading && tab === 'household' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 mb-1">Haushalt</p>
            <p className="font-semibold text-gray-900">{household?.name}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-sm font-semibold text-gray-700">Mitglieder ({members.length})</p>
            </div>
            {members.map(member => (
              <div key={member.id} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-b-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                  <span className="text-blue-600 text-xs font-bold">
                    {member.user_id.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {member.user_id === user?.id ? 'Du' : `Mitglied`}
                  </p>
                  <p className="text-xs text-gray-400">{member.role === 'admin' ? 'Admin' : 'Mitglied'}</p>
                </div>
                {myRole === 'admin' && member.user_id !== user?.id && (
                  <button
                    onClick={() => removeMember(member.user_id)}
                    className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center"
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {myRole === 'admin' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Mitglied einladen</p>

              <button
                onClick={handleGenerateLink}
                disabled={inviteLoading}
                className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-600 font-medium py-3 rounded-xl text-sm"
              >
                {inviteLoading
                  ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  : <><Link size={16} /> Einladungslink generieren</>
                }
              </button>

              {inviteLink && (
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-gray-500 break-all">{inviteLink}</p>
                  <button
                    onClick={copyLink}
                    className="flex items-center gap-2 text-sm font-medium text-blue-600"
                  >
                    {copiedLink ? <><Check size={14} /> Kopiert!</> : <><Copy size={14} /> Link kopieren</>}
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 font-semibold py-3.5 rounded-xl mt-4 min-touch"
          >
            <LogOut size={18} />
            Abmelden
          </button>
        </div>
      )}
    </div>
  )
}
