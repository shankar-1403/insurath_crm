/**
 * Sales and management users (for assignment), plus the signed-in user as
 * "Self" when they are not already listed.
 */
export function assignableProcessUsers(processUsers, currentUid, usersById) {
  if (!currentUid) return processUsers
  if (processUsers.some((u) => u.uid === currentUid)) return processUsers
  const me = usersById[currentUid]
  return [
    {
      uid: currentUid,
      displayName: me?.displayName,
      email: me?.email,
      isSelfOption: true,
    },
    ...processUsers,
  ]
}

export function labelAssignableUser(u) {
  if (u.isSelfOption) {
    const name = u.displayName || u.email || 'you'
    return `Self (${name})`
  }
  return u.displayName || u.email || u.uid.slice(0, 8)
}

/** Sales-role users, plus Self when the signed-in user is not in that list. */
export function assignableSalesUsers(salesUsers, currentUid, usersById) {
  if (!currentUid) return salesUsers
  if (salesUsers.some((u) => u.uid === currentUid)) return salesUsers
  const me = usersById[currentUid]
  return [
    {
      uid: currentUid,
      displayName: me?.displayName,
      email: me?.email,
      isSelfOption: true,
    },
    ...salesUsers,
  ]
}

/** Options for filtering leads by process assignee (includes Self when needed). */
export function processUserFilterOptions(processUsers, currentUid, usersById) {
  const rest = processUsers.map((u) => ({
    id: u.uid,
    label: u.displayName || u.email || u.uid.slice(0, 8),
  }))
  if (!currentUid || rest.some((o) => o.id === currentUid)) return rest
  const me = usersById[currentUid]
  const name = me?.displayName || me?.email || currentUid.slice(0, 8)
  return [{ id: currentUid, label: `Self (${name})` }, ...rest]
}
