import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";

export function useDeepLinks() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = CapApp.addListener("appUrlOpen", (event) => {
      try {
        const url = new URL(event.url);

        // Magic link: api.eulesia.org/api/v1/auth/verify/:token
        const verifyMatch = url.pathname.match(/\/api\/v1\/auth\/verify\/(.+)/);
        if (verifyMatch) {
          navigate(`/auth/verify/${verifyMatch[1]}`);
          return;
        }

        // App links: eulesia.org/*
        if (
          url.hostname === "eulesia.org" ||
          url.hostname === "www.eulesia.org" ||
          url.hostname === "eulesia.eu" ||
          url.hostname === "www.eulesia.eu"
        ) {
          navigate(url.pathname + url.search);
        }
      } catch (e) {
        console.warn("Deep link parse error:", e);
      }
    });

    return () => {
      listener.then((l) => l.remove());
    };
  }, [navigate]);
}

export function DeepLinkHandler() {
  useDeepLinks();
  return null;
}
