import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "eu.eulesia.app",
  appName: "Eulesia",
  webDir: "dist",
  server: {
    // Development: uncomment to proxy to Vite dev server
    // url: 'http://YOUR_LOCAL_IP:5173',
    androidScheme: "https",
    allowNavigation: ["api.eulesia.org", "api.eulesia.eu"],
  },
  ios: {
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    Keyboard: {
      resize: "none",
      resizeOnFullScreen: false,
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: "#1e3a8a",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
