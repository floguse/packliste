import { useState } from 'react'
import { Luggage } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

type Mode = 'login' | 'register' | 'reset'

export default function AuthPage() {
  const { signIn, signUp, resetPassword } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError(error)
    } else if (mode === 'register') {
      const { error } = await signUp(email, password)
      if (error) setError(error)
      else setSuccess('Registrierung erfolgreich! Bitte bestätige deine E-Mail-Adresse.')
    } else {
      const { error } = await resetPassword(email)
      if (error) setError(error)
      else setSuccess('Reset-Link wurde gesendet. Prüfe dein Postfach.')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 pt-safe">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Luggage className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Packliste</h1>
          <p className="text-gray-500 mt-1 text-sm">Dein smarter Reise-Assistent</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-5">
            {mode === 'login' ? 'Anmelden' : mode === 'register' ? 'Konto erstellen' : 'Passwort zurücksetzen'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                placeholder="name@beispiel.de"
                autoComplete="email"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  placeholder="Mindestens 6 Zeichen"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={6}
                />
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}
            {success && (
              <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl">{success}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl min-touch flex items-center justify-center disabled:opacity-60"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : mode === 'login' ? 'Anmelden' : mode === 'register' ? 'Konto erstellen' : 'Link senden'}
            </button>
          </form>

          <div className="mt-4 space-y-2 text-center text-sm">
            {mode === 'login' && (
              <>
                <button onClick={() => { setMode('reset'); setError(null) }} className="text-blue-600 block w-full py-1">
                  Passwort vergessen?
                </button>
                <button onClick={() => { setMode('register'); setError(null) }} className="text-gray-500 block w-full py-1">
                  Noch kein Konto? <span className="text-blue-600 font-medium">Registrieren</span>
                </button>
              </>
            )}
            {(mode === 'register' || mode === 'reset') && (
              <button onClick={() => { setMode('login'); setError(null); setSuccess(null) }} className="text-gray-500 block w-full py-1">
                Zurück zur Anmeldung
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
