import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Storage URL for images
export const STORAGE_URL = 'https://ygczcwuwmxhnbbfipfby.supabase.co/storage/v1/object/public'

// Helper functions
export const getBarberImageUrl = (slug) => `${STORAGE_URL}/barbers/${slug}.jpeg`
export const getBackgroundImageUrl = (filename) => `${STORAGE_URL}/backgrounds/${filename}`
export const getLogoUrl = (type = 'white') => `${STORAGE_URL}/logo/logo.${type}.PNG`
