import '@fontsource-variable/inter';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import './styles/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { TooltipProvider } from './components/ui/Overlay';
import { queryClient } from './lib/queries';
import { useIsDark, useUi } from './lib/store';
import { router } from './router';

// Keep the accent colour in sync with saved preferences.
document.documentElement.dataset.accent = useUi.getState().accent;

function AppToaster() {
  const dark = useIsDark();
  return (
    <Toaster
      position="bottom-center"
      theme={dark ? 'dark' : 'light'}
      toastOptions={{
        className: '!rounded-xl !border-line !shadow-lg !text-[13px] !font-sans',
      }}
    />
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={400}>
        <RouterProvider router={router} />
        <AppToaster />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
