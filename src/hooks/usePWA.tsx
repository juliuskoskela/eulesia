import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
} from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PWAContextType {
  needRefresh: boolean;
  updateServiceWorker: () => void;
  offlineReady: boolean;
  canInstall: boolean;
  installApp: () => Promise<void>;
}

const PWAContext = createContext<PWAContextType>({
  needRefresh: false,
  updateServiceWorker: () => {},
  offlineReady: false,
  canInstall: false,
  installApp: async () => {},
});

export function PWAProvider({ children }: { children: ReactNode }) {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Capture install prompt before it's shown
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    async function registerSW() {
      if (!("serviceWorker" in navigator)) return;

      try {
        const { registerSW } = await import("virtual:pwa-register");
        registerSW({
          immediate: true,
          onRegisteredSW(_swUrl, r) {
            if (r) {
              setRegistration(r);
              // Check for updates periodically (every hour)
              setInterval(
                () => {
                  r.update();
                },
                60 * 60 * 1000,
              );
            }
          },
          onOfflineReady() {
            setOfflineReady(true);
          },
          onNeedRefresh() {
            setNeedRefresh(true);
          },
        });
      } catch {
        // SW registration fails in dev mode, that's fine
      }
    }
    registerSW();
  }, []);

  const updateServiceWorker = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      setNeedRefresh(false);
      window.location.reload();
    }
  }, [registration]);

  const installApp = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
    }
  }, [installPrompt]);

  return (
    <PWAContext.Provider
      value={{
        needRefresh,
        updateServiceWorker,
        offlineReady,
        canInstall: !!installPrompt,
        installApp,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
}

export function usePWA() {
  return useContext(PWAContext);
}
