const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uctujsmnhmpysacqkuif.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjdHVqc21uaG1weXNhY3FrdWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyMTc4NzMsImV4cCI6MjEwMzc5Mzg3M30.l6EEIIqRyUGa5uLk8pvo1CueYZ5h_N_N3EPrX-disOs';
// Prioritize SUPABASE_SERVICE_ROLE_KEY for privileged backend operations that bypass RLS
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

module.exports = {
  supabase,
  SUPABASE_URL,
  SUPABASE_ANON_KEY: SUPABASE_KEY
};

