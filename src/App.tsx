import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { useHousehold } from './contexts/HouseholdContext'
import AuthPage from './components/auth/AuthPage'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import ArchivePage from './pages/ArchivePage'
import SettingsPage from './pages/SettingsPage'
import InvitePage from './pages/InvitePage'
import PlanningWizard from './components/planning/PlanningWizard'
import PackingView from './components/packing/PackingView'
import CreateHousehold from './components/auth/CreateHousehold'

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  const { user, loading: authLoading } = useAuth()
  const { household, loading: householdLoading } = useHousehold()

  if (authLoading || (user && householdLoading)) return <Spinner />

  if (!user) {
    return (
      <Routes>
        <Route path="/invite" element={<InvitePage />} />
        <Route path="*" element={<AuthPage />} />
      </Routes>
    )
  }

  if (!household) {
    return (
      <Routes>
        <Route path="/invite" element={<InvitePage />} />
        <Route path="*" element={<CreateHousehold />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/invite" element={<InvitePage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/archive" element={<ArchivePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="/trip/new" element={<PlanningWizard />} />
      <Route path="/trip/:id" element={<PackingView />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
