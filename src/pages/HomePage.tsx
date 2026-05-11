import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Luggage, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../contexts/HouseholdContext'
import { Trip, TripItem } from '../types'

interface TripWithProgress extends Trip {
  total: number
  packed: number
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{value} von {max} gepackt</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function HomePage() {
  const { household } = useHousehold()
  const navigate = useNavigate()
  const [trips, setTrips] = useState<TripWithProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!household) return
    let cancelled = false

    async function load() {
      const { data: tripData } = await supabase
        .from('trips')
        .select('*, trip_type:trip_types(id, name, household_id)')
        .eq('household_id', household!.id)
        .in('status', ['planning', 'packing'])
        .order('created_at', { ascending: false })

      if (cancelled || !tripData) { setLoading(false); return }

      const withProgress = await Promise.all(
        tripData.map(async (trip) => {
          const { data: items } = await supabase
            .from('trip_items')
            .select('packed')
            .eq('trip_id', trip.id)

          return {
            ...trip,
            total: items?.length ?? 0,
            packed: items?.filter((i: Pick<TripItem, 'packed'>) => i.packed).length ?? 0,
          } as TripWithProgress
        })
      )

      if (!cancelled) { setTrips(withProgress); setLoading(false) }
    }

    load()
    return () => { cancelled = true }
  }, [household])

  const statusLabel: Record<string, string> = {
    planning: 'In Planung',
    packing: 'Packen',
  }
  const statusColor: Record<string, string> = {
    planning: 'bg-amber-100 text-amber-700',
    packing: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="px-4 pt-8 pb-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meine Reisen</h1>
          <p className="text-gray-500 text-sm mt-0.5">{household?.name}</p>
        </div>
        <button
          onClick={() => navigate('/trip/new')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm min-touch"
        >
          <Plus size={18} />
          Neue Reise
        </button>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-2xl p-5 animate-pulse h-28 border border-gray-100" />
          ))}
        </div>
      )}

      {!loading && trips.length === 0 && (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-50 rounded-full mb-4">
            <Luggage size={40} className="text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Noch keine Reise</h3>
          <p className="text-gray-400 text-sm mb-6">Erstelle deine erste Packliste und reise entspannt.</p>
          <button
            onClick={() => navigate('/trip/new')}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium inline-flex items-center gap-2"
          >
            <Plus size={18} />
            Erste Reise planen
          </button>
        </div>
      )}

      {!loading && trips.length > 0 && (
        <div className="space-y-3">
          {trips.map(trip => (
            <button
              key={trip.id}
              onClick={() => navigate(`/trip/${trip.id}`)}
              className="w-full bg-white rounded-2xl p-5 border border-gray-100 text-left active:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[trip.status]}`}>
                      {statusLabel[trip.status]}
                    </span>
                    {trip.trip_type && (
                      <span className="text-xs text-gray-400">{trip.trip_type.name}</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900 truncate">{trip.name}</h3>
                  <ProgressBar value={trip.packed} max={trip.total} />
                </div>
                <ChevronRight size={20} className="text-gray-300 mt-1 flex-shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
