export function assignedUids(assignedTo) {
  if (!assignedTo) return []
  if (Array.isArray(assignedTo)) return assignedTo.filter(Boolean)
  return Object.keys(assignedTo).filter((uid) => assignedTo[uid])
}

export function toAssignedMap(uids) {
  const m = {}
  for (const uid of uids) m[uid] = true
  return m
}
