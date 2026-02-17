
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  // Clear cache on each reload
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for(let registration of registrations) {
        registration.unregister();
      }
    });
  }

  // Force reload without cache if needed
  if (performance.getEntriesByType('navigation')[0]?.type === 'reload') {
    // Clear all caches
    if ('caches' in window) {
      caches.keys().then(function(names) {
        for (let name of names) {
          caches.delete(name);
        }
      });
    }
  }

  createRoot(document.getElementById("root")!).render(<App />);
  