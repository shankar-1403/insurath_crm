import { useEffect, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { db } from '../lib/firebase'

export function useLeads() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const r = ref(db, 'leads')
    const unsub = onValue(
      r,
      (snap) => {
        const v = snap.val()
        if (!v) {
          setLeads([])
        } else {
          const list = Object.entries(v).map(([id, data]) => ({ id, ...data }))
          list.sort((a, b) => {
            const aCreated = a.createdAt || a.updatedAt || 0
            const bCreated = b.createdAt || b.updatedAt || 0
            return aCreated - bCreated
          })
          setLeads(list)
        }
        setLoading(false)
      },
      (err) => {
        console.error(
          '[CRM] leads read denied — update Realtime Database rules (database.rules.json).',
          err,
        )
        setLeads([])
        setLoading(false)
      },
    )
    return () => unsub()
  }, [])

  return { leads, loading }
}
