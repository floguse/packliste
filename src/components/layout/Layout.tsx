import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-md mx-auto pb-24">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
