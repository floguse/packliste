import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, Copy, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../contexts/HouseholdContext'
import { useAuth } from '../contexts/AuthContext'
import { Trip } from '../types'

interface ArchivedTrip extends Trip {
  total: number
}

export default function ArchivePage() {
  const { household } = useHousehold()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [trips, setTrips] = useState<ArchivedTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [copying, setCopying] = useState<string | null>(null)

  useEffect(() => {
    if (!household) return
    let cancelled = false

    async function load() {
      const { data } = await supabase
        .from('trips')
        .select('*, trip_type:trip_types(id, name, household_id)')
        .eq('household_id', household!.id)
        .eq('status', 'done')
        .order('created_at', { ascending: false })

      if (cancelled || !data) { setLoading(false); return }

      const withCounts = await Promise.all(
        data.map(async (trip) => {
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

  async function copyAsTemplate(trip: ArchivedTrip) {
    if (!household || !user) return
    setCopying(trip.id)

    const { data: newTrip, error } = await supabase
      .from('trips')
      .insert({
        household_id: household.id,
        name: `${trip.name} (Kopie)`,
        trip_type_id: trip.trip_type_id,
        status: 'planning',
        created_by: user.id,
      })
      .select()
      .single()

    if (error || !newTrip) { setCopying(null); return }

    const { data: sourceItems } = await supabase
      .from('trip_items')
      .select('item_id, quantity')
      .eq('trip_id', trip.id)

    if (sourceItems && sourceItems.length > 0) {
      await supabase.from('trip_items').insert(
        sourceItems.map((item) => ({
          trip_id: newTrip.id,
          item_id: item.item_id,
          quantity: item.quantity,
          packed: false,
        }))
      )
    }

    setCopying(null)
    navigate(`/trip/${newTrip.id}`)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div className="px-4 pt-8 pb-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Archiv</h1>
        <p className="text-gray-500 text-sm mt-0.5">Abgeschlossene Reisen</p>
      </div>

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
                    onClick={() => copyAsTemplate(trip)}
                    disabled={copying === trip.id}
                    className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-sm font-medium min-touch disabled:opacity-50"
                    title="Als Vorlage kopieren"
                  >
                    {copying === trip.id ? (
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Copy size={16} />
                    )}
                    <span>Kopieren</span>
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
