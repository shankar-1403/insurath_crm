import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLES, ROLE_LABELS } from '../constants'

const linkClass = ({ isActive }) =>
  [
    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-[#E38D28] text-white'
      : 'text-slate-400 hover:bg-slate-800 hover:text-white',
  ].join(' ')

export default function Layout() {
  const { profile, logout } = useAuth()
  const role = String(profile?.role ?? '').trim().toLowerCase()
  const [menuOpen, setMenuOpen] = useState(false)

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-[#3388AB]/5 text-slate-100">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#3388AB]/70 bg-[#3388AB]/20 backdrop-blur">
        <div className="mx-auto max-w-350 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <NavLink to="/" onClick={closeMenu} className="flex items-center text-lg font-semibold tracking-tight text-white">
              <img src="/insurath.png" alt="Insurath logo" className="h-15 object-contain mix-blend-screen"/>
            </NavLink>
            <div className="flex items-center gap-2 sm:hidden">
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-blue-300">
                {ROLE_LABELS[role] ?? role}
              </span>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                aria-label="Toggle navigation menu"
                aria-expanded={menuOpen}
              >
                {menuOpen ? 'Close' : 'Menu'}
              </button>
            </div>
            <div className="hidden items-center justify-between gap-4 sm:flex w-full">
            <nav className="flex flex-wrap gap-1">
              {role === ROLES.ADMIN && (
                <NavLink to="/admin/users" className={linkClass} onClick={closeMenu}>
                  User management
                </NavLink>
              )}
              {role === ROLES.ADMIN && (
                <NavLink to="/admin/products" className={linkClass} onClick={closeMenu}>
                  Product master
                </NavLink>
              )}
              {role === ROLES.ADMIN && (
                <NavLink to="/admin/statuses" className={linkClass} onClick={closeMenu}>
                  Status master
                </NavLink>
              )}
              {role === ROLES.MANAGEMENT && (
                <>
                  <NavLink
                    to="/management"
                    end
                    className={linkClass}
                    onClick={closeMenu}
                  >
                    All leads
                  </NavLink>
                  <NavLink
                    to="/management/assigned"
                    className={linkClass}
                    onClick={closeMenu}
                  >
                    Assigned leads
                  </NavLink>
                </>
              )}
              {role === ROLES.SALES && (
                <NavLink to="/sales" className={linkClass} onClick={closeMenu}>
                  My leads
                </NavLink>
              )}
            </nav>
            <div className="flex flex-wrap items-center gap-2 text-sm sm:gap-3">
              <span className="hidden text-slate-500 lg:inline">
                {profile?.displayName ?? profile?.email}
              </span>
              <span className="rounded-full bg-[#E38D28]/10 px-2.5 py-0.5 text-xs font-medium text-[#E38D28]">
                {ROLE_LABELS[role] ?? role}
              </span>
              <button
                type="button"
                onClick={() => {
                  closeMenu()
                  logout()
                }}
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-800"
              >
                Sign out
              </button>
            </div>
          </div>
          </div>
        </div>
      </header>
      {menuOpen && (
        <div className="fixed inset-x-0 top-16 z-40 px-3 sm:hidden">
          <div className="mx-auto max-w-350 space-y-3 rounded-xl border border-slate-800 bg-slate-900/95 p-3 shadow-2xl">
            <nav className="grid gap-1">
              {role === ROLES.ADMIN && (
                <NavLink to="/admin/users" className={linkClass} onClick={closeMenu}>
                  User management
                </NavLink>
              )}
              {role === ROLES.ADMIN && (
                <NavLink to="/admin/products" className={linkClass} onClick={closeMenu}>
                  Product master
                </NavLink>
              )}
              {role === ROLES.ADMIN && (
                <NavLink to="/admin/statuses" className={linkClass} onClick={closeMenu}>
                  Status master
                </NavLink>
              )}
              {role === ROLES.MANAGEMENT && (
                <>
                  <NavLink
                    to="/management"
                    end
                    className={linkClass}
                    onClick={closeMenu}
                  >
                    All leads
                  </NavLink>
                  <NavLink
                    to="/management/assigned"
                    className={linkClass}
                    onClick={closeMenu}
                  >
                    Assigned leads
                  </NavLink>
                </>
              )}
              {role === ROLES.SALES && (
                <NavLink to="/sales" className={linkClass} onClick={closeMenu}>
                  My leads
                </NavLink>
              )}
            </nav>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
              <span className="truncate text-xs text-slate-400">
                {profile?.displayName ?? profile?.email}
              </span>
              <button
                type="button"
                onClick={() => {
                  closeMenu()
                  logout()
                }}
                className="shrink-0 rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
      <main className="mx-auto max-w-350 px-3 pb-5 pt-24 sm:px-4 sm:pb-8 sm:pt-28">
        <Outlet />
      </main>
    </div>
  )
}
