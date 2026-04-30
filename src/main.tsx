import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { getRouter } from './router'
import './styles.css'
import { ShelbyHostProvider } from './context/ShelbyHostContext'
import { AptosProviderClient } from './components/shelbyhost/AptosWalletClient'
import { Toaster } from 'sonner'

const router = getRouter()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AptosProviderClient>
      <ShelbyHostProvider>
        <RouterProvider router={router} />
        <Toaster position="top-center" richColors />
      </ShelbyHostProvider>
    </AptosProviderClient>
  </StrictMode>,
)
