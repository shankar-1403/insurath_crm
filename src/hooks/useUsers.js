import { useEffect, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { db } from '../lib/firebase'
import { ROLES } from '../constants'

export function useUsers() {
  const [usersById, setUsersById] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const r = ref(db, 'users')
    const unsub = onValue(
      r,
      (snap) => {
        setUsersById(snap.val() ?? {})
        setError(null)
        setLoading(false)
      },
      (err) => {
        console.error(
          '[CRM] users read denied — rules must allow auth users to read /users (see database.rules.json).',
          err,
        )
        setUsersById({})
        setError(err)
        setLoading(false)
      },
    )
    return () => unsub()
  }, [])

  const processUsers = Object.entries(usersById)
    .filter(([, u]) => {
      const role = String(u?.role ?? '')
        .trim()
        .toLowerCase()
      return role === ROLES.PROCESS
    })
    .map(([uid, u]) => ({ uid, ...u }))

  const salesUsers = Object.entries(usersById)
    .filter(([, u]) => {
      const role = String(u?.role ?? '')
        .trim()
        .toLowerCase()
      return role === ROLES.SALES
    })
    .map(([uid, u]) => ({ uid, ...u }))

  return { usersById, processUsers, salesUsers, loading, error }
}
