import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { deleteApp, initializeApp } from 'firebase/app'
import { ref, get, set } from 'firebase/database'
import { auth, db, firebaseConfig } from '../lib/firebase'

const AuthContext = createContext(null)

/** Client-side session cap: auto sign-out after this duration from login (per UID). */
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000
const SESSION_STORAGE_KEY = 'crm_auth_session_v1'

function readSessionRecord() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw)
    if (
      o &&
      typeof o.uid === 'string' &&
      typeof o.startMs === 'number' &&
      Number.isFinite(o.startMs)
    ) {
      return o
    }
  } catch {
    /* ignore */
  }
  return null
}

function writeSessionRecord(uid, startMs) {
  try {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ uid, startMs }),
    )
  } catch {
    /* ignore */
  }
}

function clearSessionRecord() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  /** Why role is missing: helps tell rules vs empty DB vs bad shape */
  const [profileIssue, setProfileIssue] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid) => {
    setProfileIssue(null)
    try {
      const snap = await get(ref(db, `users/${uid}`))
      if (!snap.exists()) {
        setProfile(null)
        setProfileIssue('missing_profile')
        return null
      }
      const data = snap.val()
      const merged = { uid, ...data }
      setProfile(merged)
      if (data?.role == null || String(data.role).trim() === '') {
        setProfileIssue('missing_role')
        return merged
      }
      setProfileIssue(null)
      return merged
    } catch (e) {
      console.error(
        '[CRM] Could not read users/' +
          uid +
          ' — check Realtime Database rules (see database.rules.json).',
        e,
      )
      setProfile(null)
      const denied =
        e?.code === 'PERMISSION_DENIED' ||
        String(e?.message ?? '').includes('Permission denied')
      setProfileIssue(denied ? 'permission_denied' : 'read_error')
      return null
    }
  }, [])

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        await loadProfile(u.uid)
      } else {
        setProfile(null)
        setProfileIssue(null)
      }
      setLoading(false)
    })
  }, [loadProfile])

  useEffect(() => {
    if (!user) {
      return
    }

    const uid = user.uid
    let record = readSessionRecord()
    if (!record || record.uid !== uid) {
      const startMs = Date.now()
      writeSessionRecord(uid, startMs)
      record = { uid, startMs }
    }

    const signOutIfExpired = () => {
      const r = readSessionRecord()
      if (!r || r.uid !== uid) return
      if (Date.now() - r.startMs >= SESSION_DURATION_MS) {
        clearSessionRecord()
        signOut(auth).catch(() => {})
      }
    }

    const elapsed = Date.now() - record.startMs
    if (elapsed >= SESSION_DURATION_MS) {
      clearSessionRecord()
      signOut(auth).catch(() => {})
      return
    }

    const remaining = SESSION_DURATION_MS - elapsed
    const timeoutId = setTimeout(signOutIfExpired, remaining)
    const intervalId = setInterval(signOutIfExpired, 60_000)

    return () => {
      clearTimeout(timeoutId)
      clearInterval(intervalId)
    }
  }, [user])

  const login = useCallback(async (email, password) => {
    await signInWithEmailAndPassword(auth, email, password)
  }, [])

  const logout = useCallback(async () => {
    clearSessionRecord()
    await signOut(auth)
  }, [])

  const register = useCallback(async (email, password, displayName, role) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    try {
      await set(ref(db, `users/${cred.user.uid}`), {
        email,
        displayName: displayName || email.split('@')[0],
        role,
        createdAt: Date.now(),
      })
    } catch (e) {
      console.error(
        '[CRM] Could not write user profile — Realtime Database rules must allow writes to users/<uid> for the signed-in user.',
        e,
      )
      throw e
    }
    await loadProfile(cred.user.uid)
  }, [loadProfile])

  const createUserByAdmin = useCallback(
    async (email, password, displayName, role, extraProfile = {}) => {
      if (String(role).trim().toLowerCase() === 'admin') {
        throw new Error(
          'Only one admin is allowed. Admin account creation is disabled.',
        )
      }
      const secondaryApp = initializeApp(
        firebaseConfig,
        `admin-create-${Date.now()}`,
      )
      const secondaryAuth = getAuth(secondaryApp)
      try {
        const cred = await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          password,
        )
        const base = {
          email,
          displayName: displayName || email.split('@')[0],
          role,
          createdAt: Date.now(),
          createdByAdminUid: user?.uid ?? null,
        }
        const merged = { ...base, ...extraProfile }
        const payload = Object.fromEntries(
          Object.entries(merged).filter(([, v]) => v !== undefined),
        )
        await set(ref(db, `users/${cred.user.uid}`), payload)
        return cred.user.uid
      } finally {
        await signOut(secondaryAuth).catch(() => {})
        await deleteApp(secondaryApp).catch(() => {})
      }
    },
    [user?.uid],
  )

  const refreshProfile = useCallback(async () => {
    if (!user) return null
    return loadProfile(user.uid)
  }, [user, loadProfile])

  const value = useMemo(
    () => ({
      user,
      profile,
      profileIssue,
      loading,
      login,
      logout,
      register,
      createUserByAdmin,
      refreshProfile,
    }),
    [
      user,
      profile,
      profileIssue,
      loading,
      login,
      logout,
      register,
      createUserByAdmin,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
