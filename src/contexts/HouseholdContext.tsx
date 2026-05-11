import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Household, HouseholdMember } from '../types'
import { useAuth } from './AuthContext'

interface HouseholdContextType {
  household: Household | null
  members: HouseholdMember[]
  loading: boolean
  createHousehold: (name: string) => Promise<{ error: string | null }>
  inviteMember: (email: string) => Promise<{ token: string | null; error: string | null }>
  removeMember: (userId: string) => Promise<{ error: string | null }>
  generateInviteLink: () => Promise<{ link: string | null; error: string | null }>
  refresh: () => void
}

const HouseholdContext = createContext<HouseholdContextType | null>(null)

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [household, setHousehold] = useState<Household | null>(null)
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    if (!user) {
      setHousehold(null)
      setMembers([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    async function load() {
      try {
        const { data: memberRow, error: memberErr } = await supabase
          .from('household_members')
          .select('household_id')
          .eq('user_id', user!.id)
          .maybeSingle()

        if (memberErr) throw memberErr

        if (!memberRow || cancelled) {
          if (!cancelled) { setHousehold(null); setMembers([]); setLoading(false) }
          return
        }

        const [{ data: hh, error: hhErr }, { data: memberList }] = await Promise.all([
          supabase.from('households').select('*').eq('id', memberRow.household_id).single(),
          supabase
            .from('household_members')
            .select('id, household_id, user_id, role, joined_at')
            .eq('household_id', memberRow.household_id),
        ])

        if (hhErr) throw hhErr
        if (cancelled) return
        setHousehold(hh ?? null)
        setMembers(memberList ?? [])
        setLoading(false)
      } catch (err) {
        console.error('Household load error:', err)
        if (!cancelled) { setHousehold(null); setMembers([]); setLoading(false) }
      }
    }

    load()
    return () => { cancelled = true }
  }, [user, tick])

  async function createHousehold(name: string) {
    if (!user) return { error: 'Not authenticated' }

    // Single SECURITY DEFINER function: creates household + member + seed atomically
    const { error } = await supabase.rpc('create_household_with_member', { p_name: name })
    if (error) return { error: error.message }

    refresh()
    return { error: null }
  }

  async function inviteMember(email: string) {
    if (!household) return { token: null, error: 'No household' }

    const { data, error } = await supabase
      .from('invitations')
      .insert({ household_id: household.id, email })
      .select('token')
      .single()

    if (error || !data) return { token: null, error: error?.message ?? 'Failed to create invitation' }
    return { token: data.token as string, error: null }
  }

  async function generateInviteLink() {
    if (!household) return { link: null, error: 'No household' }

    const { data, error } = await supabase
      .from('invitations')
      .insert({ household_id: household.id })
      .select('token')
      .single()

    if (error || !data) return { link: null, error: error?.message ?? 'Failed to generate link' }

    const link = `${window.location.origin}/invite?token=${data.token}`
    return { link, error: null }
  }

  async function removeMember(userId: string) {
    if (!household) return { error: 'No household' }

    const { error } = await supabase
      .from('household_members')
      .delete()
      .eq('household_id', household.id)
      .eq('user_id', userId)

    if (error) return { error: error.message }
    refresh()
    return { error: null }
  }

  return (
    <HouseholdContext.Provider value={{
      household, members, loading, createHousehold,
      inviteMember, removeMember, generateInviteLink, refresh,
    }}>
      {children}
    </HouseholdContext.Provider>
  )
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider')
  return ctx
}
