import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase, checkSupabaseDB } from '../lib/supabase';

interface ConnectionStatusProps {
  onRetry: () => void;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ onRetry }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [lastChecked, setLastChecked] = useState<string>('');
  const [checkCount, setCheckCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [retryAttempts, setRetryAttempts] = useState(0);
  
  const addDebugInfo = (message: string) => {
    console.log(`Connection check: ${message}`);
    setDebugInfo(prev => [...prev.slice(-9), message]);
  };

  // Check online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Reset retry count when we go back online to allow immediate connection check
      setRetryAttempts(0);
    };
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Function to check Supabase connection with proper error handling
  const checkSupabaseConnection = useCallback(async () => {
    if (!isOnline) {
      setSupabaseStatus('disconnected');
      setErrorMessage('Your device is offline');
      addDebugInfo('Network offline, skipping Supabase check');
      return;
    }
    
    try {
      setSupabaseStatus('checking');
      addDebugInfo('Checking Supabase connection...');
      
      // Try the simple session check first as it's less likely to have permission issues
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (!error) {
          addDebugInfo('Session check succeeded');
          setSupabaseStatus('connected');
          setErrorMessage('');
          setRetryAttempts(0); // Reset retry attempts on success
          return;
        } else {
          addDebugInfo(`Session check error: ${error.message}`);
          // Continue to other methods
        }
      } catch (sessionError) {
        addDebugInfo(`Session check failed: ${sessionError instanceof Error ? sessionError.message : 'Unknown error'}`);
        // Continue to other methods
      }
      
      // Try the database check as a fallback
      try {
        const connected = await checkSupabaseDB();
        
        if (connected) {
          addDebugInfo('DB check succeeded');
          setSupabaseStatus('connected');
          setErrorMessage('');
          setRetryAttempts(0); // Reset retry attempts on success
          return;
        } else {
          addDebugInfo('DB check failed');
          // Set status to disconnected below
        }
      } catch (dbCheckError) {
        const errorMsg = dbCheckError instanceof Error ? dbCheckError.message : 'Unknown error';
        addDebugInfo(`DB check error: ${errorMsg}`);
        
        // Set a user-friendly error message based on the error
        if (errorMsg.includes('timeout')) {
          setErrorMessage('The server is taking too long to respond');
        } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('Unable to reach')) {
          setErrorMessage('Cannot connect to the Supabase server');
        } else {
          setErrorMessage(errorMsg);
        }
      }
      
      // If we reach here, we couldn't connect
      setSupabaseStatus('disconnected');
      if (!errorMessage) {
        setErrorMessage('Cannot connect to the database');
      }
      addDebugInfo('Supabase connection checks failed');
      
      // Update last checked time
      const now = new Date();
      setLastChecked(now.toLocaleTimeString());
      setCheckCount(prev => prev + 1);
    } catch (error) {
      console.error('Error checking Supabase connection:', error);
      addDebugInfo(`Connection check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSupabaseStatus('disconnected');
      setErrorMessage('Unable to check connection status');
      
      // Update last checked time anyway
      const now = new Date();
      setLastChecked(now.toLocaleTimeString());
    }
  }, [isOnline, errorMessage]);
  
  // Handle manual retry
  const handleRetry = useCallback(() => {
    // Reset error message
    setErrorMessage('');
    // Reset retry attempts to force an immediate check
    setRetryAttempts(0);
    // Trigger the retry function from props
    onRetry();
    // Then check connection again
    checkSupabaseConnection();
  }, [checkSupabaseConnection, onRetry]);
  
  // Check connection on initial load and when network status changes
  useEffect(() => {
    // Only check connection if we're on the login page
    const isLoginPage = window.location.pathname.includes('/auth');
    
    // Skip auto-checking if we're on login page - wait for manual retry instead
    if (isLoginPage && supabaseStatus !== 'checking') {
      addDebugInfo('On login page, skipping automatic connection check');
      return;
    }
    
    // Initial check
    checkSupabaseConnection();
    
    // Check connection periodically with exponential backoff
    // Start with 5 seconds, then increase exponentially with each retry
    const getRetryDelay = () => {
      // Base delay is 5 seconds
      const baseDelay = 5000;
      // Max delay is 2 minutes
      const maxDelay = 120000;
      
      if (retryAttempts === 0) return baseDelay;
      
      // Calculate exponential backoff: baseDelay * 2^retryAttempts
      const delay = Math.min(
        baseDelay * Math.pow(2, retryAttempts),
        maxDelay
      );
      
      // Add a small random jitter to prevent all clients from retrying simultaneously
      return delay + (Math.random() * 1000);
    };
    
    const intervalId = setTimeout(() => {
      checkSupabaseConnection();
      setRetryAttempts(prev => prev + 1);
    }, getRetryDelay());
    
    return () => clearTimeout(intervalId);
  }, [checkSupabaseConnection, retryAttempts, isOnline, supabaseStatus]);
  
  // Don't show anything when everything is working
  if (isOnline && supabaseStatus === 'connected') {
    return null;
  }
  
  return (
    <div className="fixed top-0 left-0 right-0 p-3 bg-red-500 text-white z-50">
      <div className="flex items-center justify-center">
        {!isOnline ? (
          <>
            <WifiOff className="h-5 w-5 mr-2" />
            <span>You are currently offline. Please check your internet connection.</span>
          </>
        ) : supabaseStatus === 'disconnected' ? (
          <>
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span>{errorMessage || 'Unable to connect to the server. Some features may not work correctly.'}</span>
            <span className="ml-2 text-xs opacity-75">Last checked: {lastChecked}</span>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white mr-2"></div>
            <span>Checking connection...</span>
          </>
        )}
        <button
          onClick={handleRetry}
          className="ml-4 inline-flex items-center px-3 py-1 bg-white bg-opacity-20 rounded text-white text-sm hover:bg-opacity-30"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Retry
        </button>
      </div>
      
      {/* Debug information section */}
      <div className="mt-2 text-xs border-t border-white border-opacity-20 pt-2">
        <div className="flex flex-wrap justify-center">
          {debugInfo.map((info, i) => (
            <div key={i} className="mr-2 mb-1 bg-white bg-opacity-10 px-2 py-1 rounded">
              {info}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConnectionStatus;