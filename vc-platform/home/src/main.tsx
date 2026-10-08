// All subsets carry unicode-range, so the browser fetches only the Vietnamese and Latin files it needs.
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { createUserManager } from './lib/auth';
import { loadConfig, type HomeConfig } from './lib/config';

async function boot(): Promise<void> {
  const root = document.getElementById('root')!;
  let config: HomeConfig;
  try {
    config = await loadConfig();
  } catch {
    root.textContent = 'Không tải được cấu hình VC Home. Tải lại trang sau ít phút.';
    return;
  }
  const userManager = createUserManager(config);
  // `/silent` runs inside the hidden iframe of a silent sign-in: hand the response to the parent page, render nothing.
  if (window.location.pathname === '/silent') {
    await userManager.signinSilentCallback().catch(() => undefined);
    return;
  }
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <App config={config} userManager={userManager} />
      </BrowserRouter>
    </StrictMode>,
  );
}

void boot();
