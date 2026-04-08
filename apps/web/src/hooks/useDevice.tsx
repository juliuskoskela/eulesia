/**
 * @module useDevice
 *
 * React hook and context provider for E2EE device state.
 *
 * The DeviceProvider watches authentication state and automatically
 * initializes the device's cryptographic identity when the user is
 * authenticated. On logout, the local key store is cleared.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useAuth } from "./useAuth.tsx";
import { api } from "../lib/api.ts";
import { initializeDevice, replenishPreKeys } from "../lib/e2ee/index.ts";
import { clearKeyStore } from "../lib/crypto/index.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeviceContextType {
  /** The registered device ID, or null if not yet initialized. */
  deviceId: string | null;
  /** Whether the device has been successfully initialized. */
  isInitialized: boolean;
  /** Whether device initialization is currently in progress. */
  isInitializing: boolean;
  /** Error message if device initialization failed, or null. */
  error: string | null;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function DeviceProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the previous auth state to detect logout transitions
  const prevAuthRef = useRef(false);

  const initialize = useCallback(async () => {
    setIsInitializing(true);
    setError(null);

    try {
      const registration = await initializeDevice(api);
      setDeviceId(registration.deviceId);
      setIsInitialized(true);

      // After successful initialization, try to replenish pre-keys
      try {
        await replenishPreKeys(api, registration.deviceId);
      } catch (replenishErr) {
        // Non-fatal: pre-key replenishment failure should not block the app
        console.warn("Pre-key replenishment failed:", replenishErr);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Device initialization failed";
      console.error("Device initialization failed:", err);
      setError(message);
      // Device init failure is non-fatal — the app falls back to plaintext
    } finally {
      setIsInitializing(false);
    }
  }, []);

  // Initialize device when authenticated
  useEffect(() => {
    if (isAuthenticated && !isInitialized && !isInitializing) {
      initialize();
    }
  }, [isAuthenticated, isInitialized, isInitializing, initialize]);

  // Revoke server device and clear key store on logout
  useEffect(() => {
    if (prevAuthRef.current && !isAuthenticated) {
      // User just logged out — revoke the server device, then clear local crypto.
      const revokeAndClear = async () => {
        if (deviceId) {
          try {
            await api.revokeDevice(deviceId);
          } catch (err) {
            // Best-effort — session may already be invalidated.
            console.warn("Failed to revoke device on logout:", err);
          }
        }
        try {
          await clearKeyStore();
        } catch (err) {
          console.warn("Failed to clear key store on logout:", err);
        }
      };
      revokeAndClear();
      setDeviceId(null);
      setIsInitialized(false);
      setError(null);
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, deviceId]);

  return (
    <DeviceContext.Provider
      value={{
        deviceId,
        isInitialized,
        isInitializing,
        error,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDevice(): DeviceContextType {
  const context = useContext(DeviceContext);
  if (context === undefined) {
    throw new Error("useDevice must be used within a DeviceProvider");
  }
  return context;
}
