import { createClient } from '@supabase/supabase-js'

// Replace these with your actual Supabase project values
// Found in: Supabase Dashboard > Settings > API
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co'
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── DB helpers ──────────────────────────────────────────────

// TRIPS
export const tripsApi = {
  getAll: (userId) =>
    supabase.from('trips').select('*').eq('user_id', userId).order('start_date', { ascending: true }),
  create: (data) => supabase.from('trips').insert(data).select().single(),
  update: (id, data) => supabase.from('trips').update(data).eq('id', id).select().single(),
  delete: (id) => supabase.from('trips').delete().eq('id', id),
}

// DOCUMENTS
export const docsApi = {
  getAll: (userId) =>
    supabase.from('documents').select('*').eq('user_id', userId).order('expiry_date', { ascending: true }),
  create: (data) => supabase.from('documents').insert(data).select().single(),
  update: (id, data) => supabase.from('documents').update(data).eq('id', id).select().single(),
  delete: (id) => supabase.from('documents').delete().eq('id', id),
}

// LOYALTY ACCOUNTS
export const loyaltyApi = {
  getAll: (userId) =>
    supabase.from('loyalty_accounts').select('*').eq('user_id', userId).order('program'),
  create: (data) => supabase.from('loyalty_accounts').insert(data).select().single(),
  update: (id, data) => supabase.from('loyalty_accounts').update(data).eq('id', id).select().single(),
  delete: (id) => supabase.from('loyalty_accounts').delete().eq('id', id),
}

// ITINERARY ITEMS
export const itineraryApi = {
  getByTrip: (tripId) =>
    supabase.from('itinerary_items').select('*').eq('trip_id', tripId).order('item_date').order('sort_order'),
  create: (data) => supabase.from('itinerary_items').insert(data).select().single(),
  update: (id, data) => supabase.from('itinerary_items').update(data).eq('id', id).select().single(),
  delete: (id) => supabase.from('itinerary_items').delete().eq('id', id),
}

// RESERVATIONS (files imported via Flask/Claude)
export const reservationsApi = {
  getByTrip: (tripId) =>
    supabase.from('reservations').select('*').eq('trip_id', tripId).order('start_date'),
}

export async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || ''
}
