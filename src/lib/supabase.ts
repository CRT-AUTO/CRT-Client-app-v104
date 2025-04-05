import { createClient } from '@supabase/supabase-js';

// Get environment variables with more explicit checks
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Log configuration state to help with debugging
console.log('Supabase Configuration Status:', { 
  urlConfigured: !!supabaseUrl, 
  keyConfigured: !!supabaseAnonKey,
  url: supabaseUrl ? `${supabaseUrl.substring(0, 8)}...` : 'missing', // Only show beginning for security
  mode: import.meta.env.MODE || 'unknown'
});

// Create a dummy client if environment variables are missing
let supabase;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ Missing Supabase environment variables:', { 
    supabaseUrl: supabaseUrl ? 'set' : 'missing', 
    supabaseAnonKey: supabaseAnonKey ? 'set' : 'missing'
  });
  
  // Create a mock client that returns errors for all operations
  supabase = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: new Error('Supabase not configured') }),
      getUser: async () => ({ data: { user: null }, error: new Error('Supabase not configured') }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } }, error: null })
    },
    from: () => ({
      select: () => ({ data: null, error: new Error('Supabase not configured') }),
      insert: () => ({ data: null, error: new Error('Supabase not configured') }),
      update: () => ({ data: null, error: new Error('Supabase not configured') }),
      delete: () => ({ data: null, error: new Error('Supabase not configured') }),
    }),
    rpc: () => ({ data: null, error: new Error('Supabase not configured') })
  };
} else {
  // Create the Supabase client with required configuration
  // NOTE: Simplified client initialization to ensure proper headers are set by Supabase's internal mechanisms
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });
  
  // Log successful initialization
  console.log('Supabase client initialized successfully');
}

// Export the client (either real or mock)
export { supabase };

// Helper function to check if we have working authentication
export async function checkSupabaseAuth() {
  try {
    console.log('Checking Supabase auth...');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Cannot check auth: Supabase not configured');
      return false;
    }
    
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Supabase authentication check failed:', error);
      return false;
    }
    
    console.log('Auth check result:', { hasSession: !!session });
    return !!session;
  } catch (error) {
    console.error('Failed to check Supabase authentication:', error);
    return false;
  }
}

// Helper to log detailed errors from Supabase
export function logSupabaseError(operation: string, error: any) {
  const errorDetails = {
    operation,
    message: error?.message || 'Unknown error',
    code: error?.code,
    hint: error?.hint,
    details: error?.details,
    status: error?.status
  };
  
  console.error('Supabase error:', errorDetails);
}

// Function to check database connectivity
export async function checkSupabaseDB() {
  try {
    console.log('Testing database connection...');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Cannot check database: Supabase not configured');
      return false;
    }
    
    // Use getUser as a simple connectivity test
    console.log('Checking database connection via auth.getUser()...');
    const { data, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Database connection check failed via auth.getUser():', error);
      return false;
    }
    
    console.log('Database connection is working (via user check)');
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}

// Function to clear any stored sessions
export async function clearSupabaseAuth() {
  try {
    console.log('Attempting to clear Supabase auth session...');
    
    // Try manually removing auth from localStorage first
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('sb-'))) {
          console.log(`Removing localStorage item: ${key}`);
          localStorage.removeItem(key);
        }
      }
    } catch (storageError) {
      console.warn('Error clearing localStorage:', storageError);
      // Continue even if this fails
    }
    
    // Then try official signOut method
    const { error } = await supabase.auth.signOut({ 
      scope: 'global' // Use global to clear all sessions, not just the local one
    });
    
    if (error) {
      console.error('Error during sign out:', error);
      // Continue despite error - we've already cleared localStorage
    }
    
    // Extra safety measure - clear any session-related cookies
    document.cookie.split(';').forEach(cookie => {
      const [name] = cookie.split('=');
      if (name.trim().includes('supabase') || name.trim().includes('sb-')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    });
    
    console.log('Successfully cleared auth session');
    return true;
  } catch (error) {
    console.error('Exception clearing auth session:', error);
    // Still return true since we've made our best effort
    return true;
  }
}