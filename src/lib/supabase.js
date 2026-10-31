// Connexion Supabase. L'URL et la clé « publishable » sont publiques par conception :
// la sécurité repose sur les règles RLS de supabase/schema.sql, jamais sur le secret de cette clé.
import { createClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL || 'https://vijpixbrxmnslkaiumxm.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_W_jvIbb_vRZxd44hZw3h9w_EolmVPJm'
// Mettre VITE_SUPABASE_DISABLED=1 pour revenir à la base de démonstration locale.
export const supabase = import.meta.env.VITE_SUPABASE_DISABLED ? null : createClient(URL, KEY)
