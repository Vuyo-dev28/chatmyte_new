
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

// Note: We always clear storage on load (see below) to prevent stale data
// The hash-based filenames from Vite build handle cache busting for assets

// Clear cache on each reload
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
    }
  });
}

  // Clear all storage and caches on each load
  try {
    // Clear localStorage (except for critical data if needed)
    const criticalKeys: string[] = ['app_version']; // Preserve app version
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !criticalKeys.includes(key)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Clear sessionStorage
    sessionStorage.clear();

    // Clear all caches
    if ('caches' in window) {
      caches.keys().then(function(names) {
        for (let name of names) {
          caches.delete(name);
        }
      });
    }

    // Force reload without cache if this is a reload
    if (performance.getEntriesByType('navigation')[0]?.type === 'reload') {
      // Additional cache clearing on reload
      if ('caches' in window) {
        caches.keys().then(function(names) {
          for (let name of names) {
            caches.delete(name);
          }
        });
      }
    }
  } catch (error) {
    console.warn('Error clearing storage:', error);
  }

  createRoot(document.getElementById("root")!).render(<App />);
  