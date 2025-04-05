import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase, clearSupabaseAuth } from './lib/supabase';
import { getCurrentUser } from './lib/auth';
import Layout from './components/Layout';
import Auth from './components/Auth';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Messages from './pages/Messages';
import MessageDetail from './pages/MessageDetail';
import FacebookCallback from './pages/FacebookCallback';
import InstagramCallback from './pages/InstagramCallback';
import DeletionStatus from './pages/DeletionStatus';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUserManagement from './pages/admin/AdminUserManagement';
import AdminUserDetail from './pages/admin/AdminUserDetail';
import AdminWebhookSetup from './pages/admin/AdminWebhookSetup';
import AppErrorBoundary from './components/AppErrorBoundary';
import ConnectionStatus from './components/ConnectionStatus';
import type { User } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [connectionRetries, setConnectionRetries] = useState(0);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [forceReset, setForceReset] = useState(false);
  const [signOutInProgress, setSignOutInProgress] = useState(false);

  const addDebugInfo = (message: string) => {
    console.log(`App initialization: ${message}`);
    setDebugInfo(prev => [...prev.slice(-9), message]);
  };

  // Force sign out on first load to clear any stale sessions
  useEffect(() => {
    const forceClearAuth = async () => {
      try {
        setSignOutInProgress(true);
        addDebugInfo("Performing forced sign out to clear any stale sessions");
        await clearSupabaseAuth();
        addDebugInfo("Forced sign out completed");
      } catch (err) {
        addDebugInfo(`Error during forced sign out: ${err instanceof Error ? err.message : 'Unknown'}`);
      } finally {
        setSignOutInProgress(false);
      }
    };
    
    forceClearAuth();
  }, [forceReset]);

  useEffect(() => {
    // Only initialize auth after forced sign-out completes
    if (signOutInProgress) return;
    
    async function initializeAuth() {
      try {
        setLoading(true);
        setError(null);
        addDebugInfo("Starting initialization");

        // Get the current session first
        addDebugInfo("Checking session");
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error getting session:', sessionError);
          addDebugInfo(`Session error: ${sessionError.message}`);
          setError('Failed to check authentication status');
          setLoading(false);
          return;
        }

        // If no session, we can stop here
        if (!session) {
          addDebugInfo("No session found");
          setUser(null);
          setLoading(false);
          setAuthChecked(true);
          return;
        }

        addDebugInfo(`Session found for: ${session.user?.email || 'unknown'}`);

        // Verify session validity by attempting to get user data
        try {
          addDebugInfo("Getting user data");
          const currentUser = await getCurrentUser();
          
          if (!currentUser) {
            addDebugInfo("User data not found - session appears to be invalid");
            // Session exists but no valid user - clear auth state
            await clearSupabaseAuth();
            setUser(null);
            setAuthChecked(true);
            setLoading(false);
            return;
          }
          
          addDebugInfo(`User data retrieved: ${currentUser.email || 'null'}`);
          setUser(currentUser);
        } catch (userError) {
          console.error('Error getting user data:', userError);
          addDebugInfo(`User data error: ${userError.message || 'Unknown error'}`);
          
          // If we can't get user data, clear the session as it might be corrupted
          await clearSupabaseAuth();
          setUser(null);
        }
        
        setAuthChecked(true);
      } catch (err) {
        console.error('Error initializing auth:', err);
        addDebugInfo(`Initialization error: ${err.message || 'Unknown error'}`);
        setError('Failed to initialize application');
      } finally {
        setLoading(false);
      }
    }

    // Add a small delay before initializing auth to ensure Supabase is ready
    const initTimeout = setTimeout(() => {
      if (!signOutInProgress) {
        initializeAuth();
      }
    }, connectionRetries * 500); // Shorter delay for better responsiveness

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      addDebugInfo(`Auth state change: ${event}`);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        try {
          const currentUser = await getCurrentUser();
          if (currentUser) {
            setUser(currentUser);
            addDebugInfo(`User signed in: ${currentUser.email || 'unknown'}`);
          } else {
            addDebugInfo('Auth event received but user data not found');
            // This should not happen normally - clear the session
            await clearSupabaseAuth();
            setUser(null);
          }
        } catch (err) {
          console.error('Error handling auth change:', err);
          addDebugInfo(`Auth change error: ${err.message || 'Unknown error'}`);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        addDebugInfo('User signed out');
      }
    });

    return () => {
      clearTimeout(initTimeout);
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [connectionRetries, signOutInProgress]);

  // Add a timeout detection mechanism
  useEffect(() => {
    if (loading && !authChecked) {
      // If loading takes more than 10 seconds, show a timeout warning
      const timeoutWarning = setTimeout(() => {
        addDebugInfo("Initialization seems to be taking longer than expected");
      }, 10000);
      
      return () => clearTimeout(timeoutWarning);
    }
  }, [loading, authChecked]);

  const handleRetry = () => {
    setConnectionRetries(prev => prev + 1);
    setForceReset(prev => !prev);
    addDebugInfo(`Retrying connection (attempt ${connectionRetries + 1})`);
  };

  const handleForceReset = async () => {
    addDebugInfo("User initiated full reset");
    
    try {
      // Clear any stored auth session
      await clearSupabaseAuth();
      
      // Force reload the application
      window.location.href = '/auth';
    } catch (error) {
      console.error("Error during force reset:", error);
      addDebugInfo(`Force reset error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Show loading spinner only during initial load
  if (loading && !authChecked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-gray-600">Initializing application...</p>
        
        {/* Debug information */}
        {debugInfo.length > 0 && (
          <div className="mt-8 p-4 bg-gray-100 rounded-md max-w-md">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Initialization Status:</h3>
            <div className="text-xs text-gray-600 space-y-1">
              {debugInfo.map((info, idx) => (
                <div key={idx} className="bg-white p-1 rounded">{info}</div>
              ))}
            </div>
            
            {/* Timeout detection - add reset options if taking too long */}
            {debugInfo.length > 2 && (
              <div className="mt-4 flex flex-col space-y-2">
                <button
                  onClick={handleRetry}
                  className="py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Initialization taking too long? Click to retry
                </button>
                <button
                  onClick={handleForceReset}
                  className="py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Force reset and go to login
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Show error state with retry button
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-4">
            {error}
          </div>
          <button
            onClick={handleRetry}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Retry
          </button>
          
          <button
            onClick={handleForceReset}
            className="ml-2 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Reset & Go to Login
          </button>
          
          {/* Debug information */}
          {debugInfo.length > 0 && (
            <div className="mt-8 p-4 bg-gray-100 rounded-md">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Debug Information:</h3>
              <div className="text-xs text-gray-600 space-y-1">
                {debugInfo.map((info, idx) => (
                  <div key={idx} className="bg-white p-1 rounded">{info}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <AppErrorBoundary>
      <ConnectionStatus onRetry={handleRetry} />
      <BrowserRouter>
        <Routes>
          {!user ? (
            <>
              <Route path="/auth" element={<Auth />} />
              <Route path="/deletion-status" element={<DeletionStatus />} />
              <Route path="*" element={<Navigate to="/auth" replace />} />
            </>
          ) : (
            <>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/messages/:id" element={<MessageDetail />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
              
              {user.role === 'admin' && (
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="users" element={<AdminUserManagement />} />
                  <Route path="users/:userId" element={<AdminUserDetail />} />
                  <Route path="webhooks" element={<AdminWebhookSetup />} />
                </Route>
              )}
              
              <Route path="/oauth/facebook/callback" element={<FacebookCallback />} />
              <Route path="/oauth/instagram/callback" element={<InstagramCallback />} />
              <Route path="/deletion-status" element={<DeletionStatus />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </>
          )}
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

export default App;