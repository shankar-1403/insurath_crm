export function assignedUids(assignedTo) {
  if (!assignedTo) return []
  if (Array.isArray(assignedTo)) return assignedTo.filter(Boolean)
  return Object.keys(assignedTo).filter((uid) => assignedTo[uid])
}

export function holderUids(createdBy) {
  if (!createdBy) return []
  if (Array.isArray(createdBy)) return createdBy.filter(Boolean)
  return Object.keys(createdBy).filter((uid) => createdBy[uid])
}


export function toAssignedMap(uids) {
  const m = {}
  for (const uid of uids) m[uid] = true
  return m
}
