import { createRoot } from 'react-dom/client';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from '@/config/msalConfig';
import App from './App.tsx';
import './index.css';

// MSAL v3 requires explicit initialization before MsalProvider is rendered.
// This handles the redirect response (auth code in the URL hash) on page load.
msalInstance.initialize().then(() => {
  createRoot(document.getElementById('root')!).render(
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  );
}).catch((err) => {
  console.error('[MSAL] Initialization failed:', err);
  // Fall back to rendering without MSAL (mock mode will still work)
  createRoot(document.getElementById('root')!).render(<App />);
});
