import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { getRouter } from './router'
import './styles.css'
import { ShelbyHostProvider } from './context/ShelbyHostContext'
import { AptosProvider } from './components/shelbyhost/AptosWallet'
import { Toaster } from 'sonner'
import { PrivyProvider } from '@privy-io/react-auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const router = getRouter()
const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID || "cloz926200000000000000000"}
      config={{
        loginMethods: ['email', 'wallet', 'google', 'github'],
        appearance: {
          theme: 'dark',
          accentColor: '#676FFF',
          showWalletLoginFirst: true,
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <AptosProvider>
          <ShelbyHostProvider>
            <RouterProvider router={router} />
            <Toaster position="top-center" richColors />
          </ShelbyHostProvider>
        </AptosProvider>
      </QueryClientProvider>
    </PrivyProvider>
  </StrictMode>,
)
