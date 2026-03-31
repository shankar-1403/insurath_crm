import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../constants'

export default function HomeRedirect() {
  const { profile } = useAuth()
  const r = String(profile?.role ?? '').trim().toLowerCase()

  if (r === ROLES.ADMIN) return <Navigate to="/admin/users" replace />
  if (r === ROLES.MANAGEMENT) return <Navigate to="/management" replace />
  if (r === ROLES.SALES) return <Navigate to="/sales" replace />
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-400">
      Unable to route: missing role on your profile.
    </div>
  )
}
