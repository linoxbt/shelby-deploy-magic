import { createContext, useContext, useMemo } from "react";
import {
  DynamicContextProvider,
  useDynamicContext,
  useIsLoggedIn,
  getAuthToken,
} from "@dynamic-labs/sdk-react-core";
import { AptosWalletConnectors } from "@dynamic-labs/aptos";
import { toast } from "sonner";
type Session = {
  ready: boolean;
  authenticated: boolean;
  user: { id: string; email?: { address: string }; linkedAccounts: any[] } | null;
  getAccessToken: () => Promise<string | null>;
  login: () => void;
  logout: () => Promise<void>;
};
const missing: Session = {
  ready: true,
  authenticated: false,
  user: null,
  getAccessToken: async () => null,
  login: () => toast.error("Wallet login is not configured. Set the Dynamic environment ID."),
  logout: async () => {},
};
const Context = createContext<Session>(missing);
const token = async () => getAuthToken() || null;
function SessionBridge({ children }: { children: React.ReactNode }) {
  const { user, sdkHasLoaded, setShowAuthFlow, handleLogOut } = useDynamicContext();
  const authenticated = useIsLoggedIn();
  const value = useMemo(
    () => ({
      ready: sdkHasLoaded,
      authenticated,
      user: user?.userId
        ? {
            id: user.userId,
            email: user.email ? { address: user.email } : undefined,
            linkedAccounts: [],
          }
        : null,
      getAccessToken: token,
      login: () => setShowAuthFlow(true),
      logout: handleLogOut,
    }),
    [user, sdkHasLoaded, authenticated, setShowAuthFlow, handleLogOut],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const dynamicConfigured = !!import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID;
export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!dynamicConfigured) return <Context.Provider value={missing}>{children}</Context.Provider>;
  return (
    <DynamicContextProvider
      settings={{
        environmentId: import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID,
        walletConnectors: [AptosWalletConnectors],
        initialAuthenticationMode: "connect-and-sign",
      }}
    >
      <SessionBridge>{children}</SessionBridge>
    </DynamicContextProvider>
  );
}
export const useAuth = () => useContext(Context);
