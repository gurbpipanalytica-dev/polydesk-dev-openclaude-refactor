import { useState, useEffect } from 'react';

/**
 * usePWA Hook
 * Manages PWA installation prompts and service worker registration
 * Phase 8.2 Implementation
 */

export const usePWA = () => {
  const [isInstalled, setIsInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // Check if PWA is already installed
  useEffect(() => {
    const checkInstallation = () => {
      // Check if running in standalone mode (installed)
      const isStandalone = 
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches ||
        window.navigator.standalone;
      
      setIsInstalled(isStandalone || window.location.search.includes('pwa=true'));
    };

    checkInstallation();
    window.addEventListener('appinstalled', checkInstallation);
    
    return () => {
      window.removeEventListener('appinstalled', checkInstallation);
    };
  }, []);

  // Listen for beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      console.log('[PWA] Install prompt available');
      // Prevent the default prompt
      e.preventDefault();
      // Store the event for later use
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Register service worker
  useEffect(() => {
    const registerServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/service-worker.js', {
            scope: '/'
          });
          
          console.log('[PWA] Service Worker registered:', registration);
          setRegistration(registration);
          
          // Check if offline ready
          if (registration.active) {
            setIsOfflineReady(true);
          }

          // Listen for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] Update available');
                setUpdateAvailable(true);
              }
            });
          });

          // Handle service worker updates
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('[PWA] Controller changed, page will reload');
            window.location.reload();
          });

          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60000); // Check every minute

        } catch (error) {
          console.error('[PWA] Service Worker registration failed:', error);
        }
      } else {
        console.warn('[PWA] Service Workers not supported');
      }
    };

    registerServiceWorker();
  }, []);

  // Show install prompt
  const installPWA = async () => {
    if (!installPrompt) {
      console.warn('[PWA] No install prompt available');
      return false;
    }

    try {
      installPrompt.prompt();
      const choiceResult = await installPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted install prompt');
        setInstallPrompt(null);
        return true;
      } else {
        console.log('[PWA] User dismissed install prompt');
        setInstallPrompt(null);
        return false;
      }
    } catch (error) {
      console.error('[PWA] Install prompt error:', error);
      return false;
    }
  };

  // Skip waiting for new service worker
  const skipWaiting = async () => {
    if (!registration) return;
    
    const newWorker = registration.waiting;
    if (!newWorker) return;

    newWorker.postMessage({ type: 'SKIP_WAITING' });
  };

  // Get service worker status
  const getStatus = () => {
    if (!registration) return 'unsupported';
    
    if (registration.installing) return 'installing';
    if (registration.waiting) return 'waiting';
    if (registration.active) return 'active';
    
    return 'unknown';
  };

  // Send message to service worker
  const sendMessage = async (message) => {
    if (!registration || !registration.active) return;
    
    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.error) {
          reject(event.data.error);
        } else {
          resolve(event.data);
        }
      };
      
      registration.active.postMessage(message, [messageChannel.port2]);
    });
  };

  // Get cache statistics
  const getCacheStats = async () => {
    if (!('caches' in window)) return null;
    
    try {
      const cacheNames = await caches.keys();
      const stats = [];
      
      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        stats.push({ name: cacheName, count: requests.length });
      }
      
      return stats;
    } catch (error) {
      console.error('[PWA] Cache stats error:', error);
      return null;
    }
  };

  // Clear cache
  const clearCache = async () => {
    if (!('caches' in window)) return false;
    
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('[PWA] Cache cleared');
      return true;
    } catch (error) {
      console.error('[PWA] Clear cache error:', error);
      return false;
    }
  };

  return {
    isInstalled,
    installPrompt,
    registration,
    isOfflineReady,
    updateAvailable,
    installPWA,
    skipWaiting,
    getStatus,
    sendMessage,
    getCacheStats,
    clearCache
  };
};

export default usePWA;
