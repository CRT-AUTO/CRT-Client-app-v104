import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { MessageSquare, AlertCircle } from 'lucide-react';
import axios from 'axios';

export default function FacebookCallback() {
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const location = useLocation();
  const navigate = useNavigate();

  const addDebugInfo = (message: string) => {
    console.log(message);
    setDebugInfo(prev => [...prev, `${new Date().toISOString().slice(11, 19)}: ${message}`]);
  };

  useEffect(() => {
    async function handleFacebookCallback() {
      try {
        // Extract code from URL
        const params = new URLSearchParams(location.search);
        const code = params.get('code');
        
        if (!code) {
          throw new Error('Authorization code not found');
        }

        addDebugInfo(`Processing Facebook callback with code: ${code.substring(0, 10)}...`);
        setStatus('processing');

        // Get the current user
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          addDebugInfo(`Error getting user: ${userError.message}`);
          throw userError;
        }
        
        if (!userData.user) {
          addDebugInfo('User not authenticated');
          throw new Error('User not authenticated');
        }

        addDebugInfo(`Authenticated as user ID: ${userData.user.id}`);

        // In a production app, we'd have a server-side endpoint to exchange the code for a token
        // For this demo app, we'll simulate successful page token retrieval
        
        try {
          addDebugInfo('Simulating Facebook token exchange...');
          
          // In a real implementation, this would make a server-side API request to exchange
          // the code for a token, and then fetch the user's Facebook pages

          // We'll simulate getting a list of pages the user has access to
          const mockPages = [
            {
              id: '540380515830720', // Use the ACTUAL page ID from your webhook logs
              name: 'Test Page',
              access_token: 'EAATk...', // This would be a real token in production
              category: 'Business'
            }
          ];
          
          if (mockPages.length === 0) {
            throw new Error('No Facebook pages found with manage permission');
          }
          
          // For demo purposes, select the first page
          const selectedPage = mockPages[0];
          addDebugInfo(`Selected page: ${selectedPage.name} (${selectedPage.id})`);
          
          // This is where we would normally exchange the short-lived token for a long-lived one
          // In production, we'd use these API endpoints:
          // 1. https://graph.facebook.com/v18.0/oauth/access_token (exchange code for user token)
          // 2. https://graph.facebook.com/v18.0/me/accounts (get pages)
          // 3. https://graph.facebook.com/v18.0/oauth/access_token (exchange page token for long-lived token)
          
          // In a real app, we'd determine the actual expiration from the token, but for demo:
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 60); // Default to 60 days
          
          addDebugInfo(`Storing connection for page ID: ${selectedPage.id}`);
          
          // Check for existing connection first
          const { data: existingConnections, error: connectionError } = await supabase
            .from('social_connections')
            .select('*')
            .eq('user_id', userData.user.id)
            .eq('fb_page_id', selectedPage.id);
            
          if (connectionError) {
            addDebugInfo(`Error checking existing connections: ${connectionError.message}`);
            throw connectionError;
          }
          
          if (existingConnections && existingConnections.length > 0) {
            // Update existing connection
            addDebugInfo('Updating existing connection');
            const { error: updateError } = await supabase
              .from('social_connections')
              .update({
                access_token: 'EAATk...mockToken123456789', // Use actual token in production
                token_expiry: expiryDate.toISOString(),
                refreshed_at: new Date().toISOString()
              })
              .eq('id', existingConnections[0].id);
              
            if (updateError) {
              addDebugInfo(`Error updating connection: ${updateError.message}`);
              throw updateError;
            }
          } else {
            // Create new connection
            addDebugInfo('Creating new Facebook connection');
            const { error: insertError } = await supabase
              .from('social_connections')
              .insert([{
                user_id: userData.user.id,
                fb_page_id: selectedPage.id, // Store the actual page ID without any prefix
                access_token: 'EAATk...mockToken123456789', // Use actual token in production
                token_expiry: expiryDate.toISOString()
              }]);
              
            if (insertError) {
              addDebugInfo(`Error creating connection: ${insertError.message}`);
              throw insertError;
            }
          }
          
          addDebugInfo('Facebook page connected successfully');
          setStatus('success');
          
          // Success! Wait a moment then redirect
          setTimeout(() => {
            navigate('/settings', { replace: true });
          }, 2000);
        } catch (apiError) {
          console.error('API Error:', apiError);
          addDebugInfo(`API Error: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
          throw new Error('Failed to process Facebook authentication');
        }
      } catch (err) {
        console.error('Facebook OAuth Error:', err);
        addDebugInfo(`Facebook OAuth Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setError('Failed to connect your Facebook account. Please try again.');
        setStatus('error');
        setProcessing(false);
      }
    }

    handleFacebookCallback();
  }, [location, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <MessageSquare className="h-12 w-12 text-indigo-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Connecting Facebook
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
          {status === 'processing' ? (
            <>
              <div className="flex justify-center mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
              <p className="text-gray-700">Processing your Facebook connection...</p>
              <p className="text-sm text-gray-500 mt-2">
                We're connecting to your Facebook page. This might take a moment.
              </p>
            </>
          ) : status === 'error' ? (
            <>
              <div className="flex justify-center mb-4">
                <AlertCircle className="h-12 w-12 text-red-500" />
              </div>
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 mb-4 rounded-md text-sm">
                {error}
              </div>
              <button
                onClick={() => navigate('/settings')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Go Back to Settings
              </button>
            </>
          ) : (
            <>
              <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 mb-4 rounded-md text-sm">
                Successfully connected to Facebook!
              </div>
              <p className="text-gray-700 mb-4">Redirecting you back to settings...</p>
            </>
          )}
          
          {/* Debug info section */}
          {debugInfo.length > 0 && (
            <div className="mt-6 p-3 bg-gray-50 rounded-md text-left">
              <p className="text-xs text-gray-500 font-semibold mb-1">Debug Information:</p>
              <div className="text-xs text-gray-500 max-h-40 overflow-y-auto">
                {debugInfo.map((info, idx) => (
                  <div key={idx}>{info}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}