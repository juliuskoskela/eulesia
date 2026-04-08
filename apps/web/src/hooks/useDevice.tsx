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
import { useTranslation } from "react-i18next";
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
  /** Retry or manually trigger device initialization for this browser. */
  initializeCurrentDevice: () => Promise<void>;
  /** Whether this session just registered a new device. */
  hasFreshRegistration: boolean;
  /** Dismiss the post-registration notice. */
  dismissFreshRegistration: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function DeviceProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation("common");
  const { isAuthenticated } = useAuth();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedInit, setHasAttemptedInit] = useState(false);
  const [hasFreshRegistration, setHasFreshRegistration] = useState(false);

  // Track the previous auth state to detect logout transitions
  const prevAuthRef = useRef(false);

  const initialize = useCallback(async () => {
    setHasAttemptedInit(true);
    setIsInitializing(true);
    setError(null);

    try {
      const registration = await initializeDevice(api);
      setDeviceId(registration.deviceId);
      setIsInitialized(true);
      setHasFreshRegistration(registration.didCreateDevice);

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
      setHasFreshRegistration(false);
      // Device init failure is non-fatal — the app falls back to plaintext
    } finally {
      setIsInitializing(false);
    }
  }, []);

  // Initialize device when authenticated
  useEffect(() => {
    if (
      isAuthenticated &&
      !isInitialized &&
      !isInitializing &&
      !hasAttemptedInit
    ) {
      void initialize();
    }
  }, [
    hasAttemptedInit,
    initialize,
    isAuthenticated,
    isInitialized,
    isInitializing,
  ]);

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
      setHasAttemptedInit(false);
      setHasFreshRegistration(false);
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
        initializeCurrentDevice: initialize,
        hasFreshRegistration,
        dismissFreshRegistration: () => setHasFreshRegistration(false),
      }}
    >
      {children}
      {hasFreshRegistration && (
        <div className="pointer-events-none fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm">
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-auto rounded-2xl border border-emerald-200 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-emerald-900 dark:bg-gray-900/95"
          >
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t("e2ee.deviceReadyTitle")}
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {t("e2ee.deviceReadyBody")}
            </p>
            <button
              type="button"
              onClick={() => setHasFreshRegistration(false)}
              className="mt-3 inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              {t("actions.close")}
            </button>
          </div>
        </div>
      )}
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
