import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";
import { ShelbyHostProvider } from "./context/ShelbyHostContext";
import { AptosProvider } from "./components/shelbyhost/AptosWallet";
import { Toaster } from "sonner";
import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { PetraWallet } from "petra-plugin-wallet-adapter";
import { Network } from "@aptos-labs/ts-sdk";

const aptosWallets = [new PetraWallet()];

const router = getRouter();
const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID || "cmouon1wz00sg0clayumgd2ls"}
      config={{
        loginMethods: ["email", "wallet", "google", "github"],
        appearance: {
          theme: "dark",
          accentColor: "#676FFF",
          showWalletLoginFirst: true,
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <AptosWalletAdapterProvider
          plugins={aptosWallets as any}
          autoConnect={true}
          dappConfig={{ network: Network.TESTNET }}
          onError={(err) => console.error("Aptos wallet error:", err)}
        >
          <AptosProvider>
            <ShelbyHostProvider>
              <RouterProvider router={router} />
              <Toaster position="top-center" richColors />
            </ShelbyHostProvider>
          </AptosProvider>
        </AptosWalletAdapterProvider>
      </QueryClientProvider>
    </PrivyProvider>
  </StrictMode>,
);
