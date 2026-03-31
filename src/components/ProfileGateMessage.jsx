import { useState } from 'react'

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export default function ProfileGateMessage({
  uid,
  profileIssue,
  onRefresh,
}) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 px-4 py-10 text-center text-slate-300">
      {profileIssue === 'permission_denied' && (
        <div className="max-w-lg space-y-3">
          <p className="text-lg font-medium text-amber-200">
            Realtime Database blocked reading your profile
          </p>
          <p className="text-sm text-slate-400">
            Rules are denying <code className="text-blue-300">users/{uid}</code>.
            Open Firebase → Realtime Database → <strong>Rules</strong>, publish
            the rules from <code className="text-blue-300">database.rules.json</code>{' '}
            in your project, then click below.
          </p>
        </div>
      )}
      {profileIssue === 'missing_profile' && (
        <div className="max-w-lg space-y-3 text-left">
          <p className="text-center text-lg font-medium text-white">
            No profile row in Realtime Database
          </p>
          <p className="text-center text-sm text-slate-400">
            Firebase Auth knows you, but Realtime Database has no row at{' '}
            <code className="text-blue-300">users/{uid}</code>. Add it manually
            (steps below) or fix <strong>Rules</strong> and register a new user.
          </p>
          <p className="text-sm text-slate-400">
            <strong>1.</strong> Firebase Console → <strong>Authentication</strong>{' '}
            → Users → copy this user&apos;s UID (must match exactly — use the
            button).
          </p>
          <p className="text-sm text-slate-400">
            <strong>2.</strong> <strong>Realtime Database</strong> →{' '}
            <strong>Data</strong> (not Firestore). Under root, add child{' '}
            <code className="text-blue-300">users</code>, then a child whose{' '}
            <strong>name is that UID</strong>.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <code className="max-w-full break-all rounded bg-slate-800 px-2 py-1 text-xs text-blue-300">
              {uid}
            </code>
            <button
              type="button"
              onClick={async () => {
                const ok = await copyText(uid)
                setCopied(ok)
                if (ok) setTimeout(() => setCopied(false), 2000)
              }}
              className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              {copied ? 'Copied' : 'Copy UID'}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs text-slate-300">
            {`users
  ${uid}
    email: "your@email.com"
    displayName: "Your Name"
    role: "management"
    createdAt: ${Date.now()}`}
          </pre>
          <p className="text-center text-xs text-slate-500">
            <code className="text-slate-400">role</code> must be exactly{' '}
            <code className="text-slate-400">admin</code>,{' '}
            <code className="text-slate-400">management</code>,{' '}
            <code className="text-slate-400">sales</code>, or{' '}
            <code className="text-slate-400">process</code>.
          </p>
        </div>
      )}
      {profileIssue === 'missing_role' && (
        <div className="max-w-lg space-y-3">
          <p className="text-lg font-medium text-white">
            Profile exists but <code className="text-blue-300">role</code> is
            missing
          </p>
          <p className="text-sm text-slate-400">
            Edit <code className="text-blue-300">users/{uid}</code> in the
            Realtime Database <strong>Data</strong> tab and add a string field{' '}
            <code className="text-blue-300">role</code>:{' '}
              <code className="text-blue-300">admin</code>,{' '}
            <code className="text-blue-300">management</code>,{' '}
            <code className="text-blue-300">sales</code>, or{' '}
            <code className="text-blue-300">process</code>.
          </p>
        </div>
      )}
      {profileIssue === 'read_error' && (
        <p className="max-w-md text-sm text-slate-400">
          Could not load your profile (network or config). Check the browser
          console and your <code className="text-blue-300">.env</code> database
          URL.
        </p>
      )}
      {!profileIssue && (
        <p className="max-w-md text-lg">
          Your account has no role in the database. Add your profile at{' '}
          <code className="rounded bg-slate-800 px-2 py-1 text-sm text-blue-300">
            users/{uid}
          </code>{' '}
          in Realtime Database.
        </p>
      )}
      <button
        type="button"
        onClick={() => onRefresh()}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
      >
        I fixed it — reload profile
      </button>
    </div>
  )
}
