import { useState } from 'react'
import { Home } from 'lucide-react'
import { useHousehold } from '../../contexts/HouseholdContext'
import { useAuth } from '../../contexts/AuthContext'

export default function CreateHousehold() {
  const { createHousehold } = useHousehold()
  const { signOut } = useAuth()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await createHousehold(name.trim())
    if (error) { setError(error); setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 pt-safe">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Home className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Haushalt erstellen</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Gib deinem Haushalt einen Namen. Familienmitglieder können später eingeladen werden.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name des Haushalts
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                placeholder="z.B. Familie Müller"
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl min-touch flex items-center justify-center disabled:opacity-60"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : 'Haushalt erstellen'}
            </button>
          </form>

          <button
            onClick={signOut}
            className="mt-4 w-full text-center text-sm text-gray-400 py-2"
          >
            Abmelden
          </button>
        </div>
      </div>
    </div>
  )
}
