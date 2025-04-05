import { supabase } from './supabase';

// Type definitions for Facebook responses
export interface FacebookAuthResponse {
  accessToken: string;
  expiresIn: number;
  signedRequest: string;
  userID: string;
}

export interface FacebookStatusResponse {
  status: 'connected' | 'not_authorized' | 'unknown' | 'error';
  authResponse: FacebookAuthResponse | null;
}

// Function to check Facebook login status
export function checkFacebookLoginStatus(): Promise<FacebookStatusResponse> {
  return new Promise((resolve, reject) => {
    // Make sure FB SDK is loaded
    if (typeof FB === 'undefined') {
      console.error('Facebook SDK not loaded');
      resolve({ status: 'error', authResponse: null });
      return;
    }

    FB.getLoginStatus((response) => {
      console.log('Facebook login status:', response);
      resolve(response as FacebookStatusResponse);
    });
  });
}

// The callback function that will be called from checkLoginState
// This aligns with the Facebook documentation pattern
export function statusChangeCallback(response: FacebookStatusResponse): Promise<boolean> {
  return handleFacebookStatusChange(response);
}

// Handle status change
export function handleFacebookStatusChange(response: FacebookStatusResponse): Promise<boolean> {
  return new Promise(async (resolve) => {
    if (response.status === 'connected' && response.authResponse) {
      // User is logged in to Facebook and has authorized the app
      console.log('Connected to Facebook, authorized app');
      
      try {
        // If you want to use this token to authenticate with your backend
        const fbToken = response.authResponse.accessToken;
        const userId = response.authResponse.userID;
        
        // Get additional user information from Facebook
        const userInfo = await getFacebookUserInfo(userId, fbToken);
        
        // You could use this to sign in to Supabase with a custom token
        // or store Facebook credentials for later API calls
        console.log('Facebook user info:', userInfo);
        
        // Sign in to Supabase with email from Facebook
        if (userInfo && userInfo.email) {
          // In a real implementation, you would store this user in your database
          // and link it with the Facebook account
          console.log('We have the user email from Facebook:', userInfo.email);
          
          // Instead of mock redirect, use actual redirect to callback with real code
          // This will initiate the real OAuth flow
          const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
          const redirectUri = `${appUrl}/oauth/facebook/callback`;
          const appId = import.meta.env.VITE_META_APP_ID;
          
          if (!appId) {
            console.error('Facebook App ID is not configured');
            resolve(false);
            return;
          }
          
          window.location.href = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=public_profile,email,pages_show_list,pages_messaging`;
        } else {
          // Redirect to callback with auth code - using our fallback approach
          const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
          window.location.href = `${appUrl}/oauth/facebook/callback?code=auth_code_${Date.now()}`;
        }
        
        resolve(true);
      } catch (error) {
        console.error('Error handling Facebook login:', error);
        resolve(false);
      }
    } else if (response.status === 'not_authorized') {
      // User is logged into Facebook but has not authorized the app
      console.log('Not authorized: User is logged into Facebook but has not authorized the app');
      
      // Redirect to Facebook OAuth dialog
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const redirectUri = `${appUrl}/oauth/facebook/callback`;
      const appId = import.meta.env.VITE_META_APP_ID;
      
      if (!appId) {
        console.error('Facebook App ID is not configured');
        resolve(false);
        return;
      }
      
      window.location.href = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=public_profile,email,pages_show_list,pages_messaging`;
      
      resolve(false);
    } else {
      // User is not logged into Facebook
      console.log('User is not logged into Facebook');
      resolve(false);
    }
  });
}

// Function to check login state - follows Facebook's documentation pattern
export function checkLoginState() {
  if (typeof FB === 'undefined') {
    console.error('Facebook SDK not loaded when checking login state');
    return;
  }
  
  FB.getLoginStatus(function(response: FacebookStatusResponse) {
    statusChangeCallback(response);
  });
}

// Function to initiate Facebook login
export function loginWithFacebook(): Promise<FacebookStatusResponse> {
  return new Promise((resolve, reject) => {
    if (typeof FB === 'undefined') {
      // If FB SDK is not loaded, redirect directly to the OAuth flow
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const redirectUri = `${appUrl}/oauth/facebook/callback`;
      const appId = import.meta.env.VITE_META_APP_ID;
      
      if (!appId) {
        reject(new Error('Facebook App ID is not configured'));
        return;
      }
      
      window.location.href = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=public_profile,email,pages_show_list,pages_messaging`;
      reject(new Error('Facebook SDK not loaded, redirecting to OAuth flow'));
      return;
    }

    FB.login((response) => {
      console.log("Facebook login response:", response);
      if (response.status === 'connected') {
        // Successful login, resolve with the response
        resolve(response as FacebookStatusResponse);
      } else {
        // Login was not successful
        console.log("Facebook login was not successful:", response);
        resolve(response as FacebookStatusResponse);
      }
    }, { scope: 'public_profile,email,pages_show_list,pages_messaging' });
  });
}

// Get user information from Facebook
export function getFacebookUserInfo(userId: string, accessToken: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof FB === 'undefined') {
      reject(new Error('Facebook SDK not loaded'));
      return;
    }
    
    FB.api(
      `/${userId}`,
      'GET',
      { fields: 'id,name,email', access_token: accessToken },
      (response: any) => {
        if (!response || response.error) {
          reject(response?.error || new Error('Failed to get user info'));
          return;
        }
        resolve(response);
      }
    );
  });
}

// Get Facebook pages
export function getFacebookPages(accessToken: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof FB === 'undefined') {
      reject(new Error('Facebook SDK not loaded'));
      return;
    }
    
    FB.api(
      '/me/accounts',
      'GET',
      { access_token: accessToken },
      (response: any) => {
        if (!response || response.error) {
          reject(response?.error || new Error('Failed to get pages'));
          return;
        }
        resolve(response.data);
      }
    );
  });
}

// A helper function to check if the Facebook SDK is ready
export function isFacebookSDKLoaded(): boolean {
  return typeof FB !== 'undefined';
}