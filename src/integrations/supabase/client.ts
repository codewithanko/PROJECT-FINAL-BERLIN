import { createClient } from "@supabase/supabase-js";

// Use the standard Vite environment variables we added to Vercel
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables. Please check your .env file or Vercel settings.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);