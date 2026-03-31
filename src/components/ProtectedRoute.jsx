import { useEffect, useRef } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ProfileGateMessage from './ProfileGateMessage'

export default function ProtectedRoute({ children, roles }) {
  const { user, profile, profileIssue, loading, refreshProfile, logout } = useAuth()
  const location = useLocation()
  const signingOutMissingProfileRef = useRef(false)

  useEffect(() => {
    if (!user || profileIssue !== 'missing_profile') return
    if (signingOutMissingProfileRef.current) return
    signingOutMissingProfileRef.current = true
    logout().finally(() => {
      signingOutMissingProfileRef.current = false
    })
  }, [user, profileIssue, logout])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!profile?.role) {
    if (profileIssue === 'missing_profile') {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
          Your account was removed. Redirecting to login…
        </div>
      )
    }
    return (
      <ProfileGateMessage
        uid={user.uid}
        profileIssue={profileIssue}
        onRefresh={refreshProfile}
      />
    )
  }

  const normalizedRole = String(profile.role ?? '').trim().toLowerCase()
  if (
    roles?.length &&
    !roles.some((allowed) => allowed === normalizedRole)
  ) {
    return <Navigate to="/" replace />
  }

  return children
}
