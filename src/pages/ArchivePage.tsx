import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, BookmarkPlus, Check, ChevronRight, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../contexts/HouseholdContext'
import { Trip, TripTemplate } from '../types'

interface ArchivedTrip extends Trip {
  total: number
}

interface SaveState {
  tripId: string
  name: string
}

export default function ArchivePage() {
  const { household } = useHousehold()
  const navigate = useNavigate()
  const [trips, setTrips] = useState<ArchivedTrip[]>([])
  const [templates, setTemplates] = useState<TripTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null)

  useEffect(() => {
    if (!household) return
    let cancelled = false

    async function load() {
      const [{ data: tripData }, { data: templateData }] = await Promise.all([
        supabase
          .from('trips')
          .select('*, trip_type:trip_types(id, name, household_id)')
          .eq('household_id', household!.id)
          .eq('status', 'done')
          .order('created_at', { ascending: false }),
        supabase
          .from('trip_templates')
          .select('*')
          .eq('household_id', household!.id)
          .order('created_at', { ascending: false }),
      ])

      if (cancelled) return

      setTemplates(templateData ?? [])

      if (!tripData) { setLoading(false); return }

      const withCounts = await Promise.all(
        tripData.map(async (trip) => {
          const { count } = await supabase
            .from('trip_items')
            .select('*', { count: 'exact', head: true })
            .eq('trip_id', trip.id)
          return { ...trip, total: count ?? 0 } as ArchivedTrip
        })
      )

      if (!cancelled) { setTrips(withCounts); setLoading(false) }
    }

    load()
    return () => { cancelled = true }
  }, [household])

  function openSaveDialog(trip: ArchivedTrip) {
    setSaveState({ tripId: trip.id, name: trip.name })
  }

  async function saveAsTemplate() {
    if (!saveState || !household) return
    setSaving(true)

    const { data: template, error } = await supabase
      .from('trip_templates')
      .insert({ household_id: household.id, name: saveState.name.trim() })
      .select()
      .single()

    if (error || !template) { setSaving(false); return }

    const { data: sourceItems } = await supabase
      .from('trip_items')
      .select('item_id, quantity')
      .eq('trip_id', saveState.tripId)

    if (sourceItems && sourceItems.length > 0) {
      await supabase.from('template_items').insert(
        sourceItems.map((item) => ({
          template_id: template.id,
          item_id: item.item_id,
          quantity: item.quantity,
        }))
      )
    }

    setTemplates(prev => [template, ...prev])
    setSavedId(saveState.tripId)
    setSaveState(null)
    setSaving(false)
    setTimeout(() => setSavedId(null), 2000)
  }

  async function deleteTemplate(templateId: string) {
    setDeletingTemplateId(templateId)
    await supabase.from('trip_templates').delete().eq('id', templateId)
    setTemplates(prev => prev.filter(t => t.id !== templateId))
    setDeletingTemplateId(null)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div className="px-4 pt-8 pb-4">
      {/* Templates Section */}
      {templates.length > 0 && (
        <div className="mb-8">
          <div className="mb-3">
            <h2 className="text-lg font-bold text-gray-900">Vorlagen</h2>
            <p className="text-gray-500 text-sm mt-0.5">Als Basis für neue Reisen verwenden</p>
          </div>
          <div className="space-y-2">
            {templates.map(template => (
              <div
                key={template.id}
                className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <BookmarkPlus size={16} className="text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{template.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(template.created_at)}</p>
                  </div>
                </div>
                <button
                  onClick={() => deleteTemplate(template.id)}
                  disabled={deletingTemplateId === template.id}
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 flex-shrink-0"
                >
                  {deletingTemplateId === template.id ? (
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Archive Section */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Archiv</h1>
        <p className="text-gray-500 text-sm mt-0.5">Abgeschlossene Reisen</p>
      </div>

      {/* Save-as-template dialog */}
      {saveState && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
          <div className="bg-white w-full max-w-md rounded-t-3xl px-5 pt-5 pb-8" style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Als Vorlage speichern</h3>
              <button onClick={() => setSaveState(null)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Vorlagenname</label>
            <input
              type="text"
              value={saveState.name}
              onChange={e => setSaveState(prev => prev ? { ...prev, name: e.target.value } : null)}
              onKeyDown={e => e.key === 'Enter' && saveState.name.trim() && saveAsTemplate()}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base mb-4"
              autoFocus
            />
            <button
              onClick={saveAsTemplate}
              disabled={saving || !saveState.name.trim()}
              className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <BookmarkPlus size={18} />
                  Vorlage speichern
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl p-5 animate-pulse h-20 border border-gray-100" />
          ))}
        </div>
      )}

      {!loading && trips.length === 0 && (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
            <Archive size={40} className="text-gray-300" />
          </div>
          <h3 className="text-lg font-semibold text-gray-500">Noch keine archivierten Reisen</h3>
          <p className="text-gray-400 text-sm mt-2">Abgeschlossene Reisen erscheinen hier.</p>
        </div>
      )}

      {!loading && trips.length > 0 && (
        <div className="space-y-3">
          {trips.map(trip => (
            <div
              key={trip.id}
              className="bg-white rounded-2xl p-5 border border-gray-100"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{trip.name}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {trip.trip_type && (
                      <span className="text-xs text-gray-400">{trip.trip_type.name}</span>
                    )}
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{trip.total} Artikel</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{formatDate(trip.created_at)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openSaveDialog(trip)}
                    className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-sm font-medium min-touch"
                    title="Als Vorlage speichern"
                  >
                    {savedId === trip.id ? (
                      <Check size={16} className="text-green-600" />
                    ) : (
                      <BookmarkPlus size={16} />
                    )}
                    <span>{savedId === trip.id ? 'Gespeichert' : 'Vorlage'}</span>
                  </button>
                  <button
                    onClick={() => navigate(`/trip/${trip.id}`)}
                    className="flex items-center justify-center w-10 h-10 bg-gray-50 rounded-xl"
                  >
                    <ChevronRight size={18} className="text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
