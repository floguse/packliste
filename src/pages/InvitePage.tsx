import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { UserPlus, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'

type State = 'loading' | 'auth' | 'info' | 'joining' | 'done' | 'error'
type AuthMode = 'login' | 'register'

export default function InvitePage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()
  const { user, signIn, signUp } = useAuth()
  const { refresh, household } = useHousehold()

  const [state, setState] = useState<State>('loading')
  const [householdName, setHouseholdName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Auth form
  const [authMode, setAuthMode] = useState<AuthMode>('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authSuccess, setAuthSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!token) { setState('error'); setErrorMsg('Ungültiger Einladungslink.'); return }

    let cancelled = false
    async function fetchInfo() {
      const { data, error } = await supabase.rpc('get_invitation_info', { p_token: token })
      if (cancelled) return
      if (error || !data || data.length === 0) {
        setState('error')
        setErrorMsg('Einladung nicht gefunden oder bereits verwendet.')
        return
      }
      setHouseholdName(data[0].household_name)
      setState(user ? 'info' : 'auth')
    }

    fetchInfo()
    return () => { cancelled = true }
  }, [token, user])

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault()
    setAuthError(null)
    setAuthSuccess(null)
    setAuthBusy(true)

    if (authMode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setAuthError(error)
    } else {
      const { error } = await signUp(email, password)
      if (error) setAuthError(error)
      else setAuthSuccess('Konto erstellt. Falls eine E-Mail-Bestätigung nötig ist, prüfe dein Postfach.')
    }
    setAuthBusy(false)
  }

  async function acceptInvitation() {
    if (!token) return
    setState('joining')
    const { data, error } = await supabase.rpc('accept_invitation', { p_token: token })
    if (error || !data) {
      setState('error')
      setErrorMsg(error?.message ?? 'Fehler beim Beitreten.')
      return
    }
    refresh()
    setState('done')
    setTimeout(() => navigate('/'), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 pt-safe">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        {state === 'loading' && (
          <div className="flex justify-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {state === 'auth' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-4">
              <UserPlus size={32} className="text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Einladung zu</h2>
            <p className="text-lg font-semibold text-blue-600 mb-5">{householdName}</p>
            <p className="text-sm text-gray-500 mb-5">
              {authMode === 'register'
                ? 'Erstelle ein Konto, um beizutreten.'
                : 'Melde dich an, um beizutreten.'}
            </p>

            <form onSubmit={submitAuth} className="space-y-3 text-left">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="E-Mail"
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Passwort (min. 6 Zeichen)"
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              />

              {authError && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-2.5 rounded-xl">{authError}</div>
              )}
              {authSuccess && (
                <div className="bg-green-50 text-green-700 text-sm px-4 py-2.5 rounded-xl">{authSuccess}</div>
              )}

              <button
                type="submit"
                disabled={authBusy}
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl min-touch flex items-center justify-center disabled:opacity-60"
              >
                {authBusy ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : authMode === 'login' ? 'Anmelden' : 'Konto erstellen'}
              </button>
            </form>

            <button
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login')
                setAuthError(null); setAuthSuccess(null)
              }}
              className="mt-4 text-sm text-gray-500"
            >
              {authMode === 'login'
                ? <>Noch kein Konto? <span className="text-blue-600 font-medium">Registrieren</span></>
                : <>Schon ein Konto? <span className="text-blue-600 font-medium">Anmelden</span></>
              }
            </button>
          </>
        )}

        {state === 'info' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-4">
              <UserPlus size={32} className="text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Einladung</h2>
            <p className="text-gray-600 mb-1">Du wurdest zum Haushalt eingeladen:</p>
            <p className="text-lg font-semibold text-blue-600 mb-6">{householdName}</p>
            {household && household.name !== householdName && (
              <p className="text-sm text-amber-600 bg-amber-50 rounded-xl px-4 py-2 mb-4">
                Du bist bereits Mitglied von „{household.name}". Ein Beitritt zu einem neuen Haushalt ist nicht möglich.
              </p>
            )}
            {(!household || household.name === householdName) && (
              <button
                onClick={acceptInvitation}
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl min-touch"
              >
                Haushalt beitreten
              </button>
            )}
            <button onClick={() => navigate('/')} className="mt-3 w-full text-gray-400 text-sm py-2">
              Abbrechen
            </button>
          </>
        )}

        {state === 'joining' && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600">Trete bei…</p>
          </div>
        )}

        {state === 'done' && (
          <>
            <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-gray-900">Willkommen!</h2>
            <p className="text-gray-500 mt-2">Du wirst weitergeleitet…</p>
          </>
        )}

        {state === 'error' && (
          <>
            <XCircle size={48} className="text-red-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Fehler</h2>
            <p className="text-gray-500 mb-6">{errorMsg}</p>
            <button onClick={() => navigate('/')} className="w-full bg-gray-100 text-gray-700 font-medium py-3 rounded-xl">
              Zur Startseite
            </button>
          </>
        )}
      </div>
    </div>
  )
}
