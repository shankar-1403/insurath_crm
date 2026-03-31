const { onCall, HttpsError } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')

admin.initializeApp()

exports.deleteUserByAdmin = onCall(async (request) => {
  const callerUid = request.auth?.uid
  const targetUid = String(request.data?.uid || '').trim()

  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'You must be logged in.')
  }
  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'uid is required.')
  }
  if (targetUid === callerUid) {
    throw new HttpsError(
      'failed-precondition',
      'Cannot delete the currently logged-in admin user.',
    )
  }

  const roleSnap = await admin
    .database()
    .ref(`users/${callerUid}/role`)
    .get()
  const callerRole = String(roleSnap.val() || '').trim().toLowerCase()
  if (callerRole !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admin can delete users.')
  }

  // Remove auth account first, then profile row.
  // If profile is already missing, auth deletion still completes.
  await admin.auth().deleteUser(targetUid)
  await admin.database().ref(`users/${targetUid}`).remove()

  return { ok: true, uid: targetUid }
})

exports.updateUserPasswordByAdmin = onCall(async (request) => {
  const callerUid = request.auth?.uid
  const targetUid = String(request.data?.uid || '').trim()
  const newPassword = String(request.data?.password || '').trim()

  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'You must be logged in.')
  }
  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'uid is required.')
  }
  if (!newPassword || newPassword.length < 6) {
    throw new HttpsError(
      'invalid-argument',
      'password is required and must be at least 6 characters.',
    )
  }

  const roleSnap = await admin
    .database()
    .ref(`users/${callerUid}/role`)
    .get()
  const callerRole = String(roleSnap.val() || '').trim().toLowerCase()
  if (callerRole !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admin can update passwords.')
  }

  try {
    await admin.auth().updateUser(targetUid, { password: newPassword })
  } catch (err) {
    const code = err?.errorInfo?.code || err?.code || ''
    const msg = String(err?.errorInfo?.message || err?.message || err)
    console.error('[updateUserPasswordByAdmin]', code, msg)

    if (code === 'auth/user-not-found') {
      throw new HttpsError(
        'not-found',
        'No Authentication user exists for this UID. Recreate the account or fix the UID.',
      )
    }
    if (code === 'auth/invalid-password' || code === 'auth/weak-password') {
      throw new HttpsError(
        'invalid-argument',
        'Password does not meet Firebase Auth requirements (try a stronger password).',
      )
    }
    throw new HttpsError(
      'failed-precondition',
      msg || 'Could not update password in Firebase Authentication.',
    )
  }
  return { ok: true, uid: targetUid }
})
