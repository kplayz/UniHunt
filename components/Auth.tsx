import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Auth() {
  const [user, setUser] = useState<any | null>(null)

  useEffect(() => {
    let mounted = true
    async function init() {
      const { data } = await supabase.auth.getUser()
      if (mounted) setUser(data.user ?? null)
    }
    init()
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signInGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' })
  }
  const signInMicrosoft = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'azure' })
  }
  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        {user.user_metadata?.avatar_url && (
          <img src={user.user_metadata.avatar_url} alt="avatar" className="h-8 w-8 rounded-full" />
        )}
        <span className="text-sm">{user.email ?? user.user_metadata?.full_name ?? 'User'}</span>
        <button onClick={signOut} className="ml-2 rounded bg-red-500 px-3 py-1 text-white text-sm">Sign out</button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={signInGoogle} className="rounded bg-blue-600 px-3 py-1 text-white text-sm">Sign in with Google</button>
      <button onClick={signInMicrosoft} className="rounded bg-gray-700 px-3 py-1 text-white text-sm">Sign in with Microsoft</button>
    </div>
  )
}
