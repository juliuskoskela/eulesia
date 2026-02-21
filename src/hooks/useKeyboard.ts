import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Hook that tracks virtual keyboard visibility and height.
 * Works on:
 * - Capacitor iOS/Android (via @capacitor/keyboard plugin)
 * - Mobile web (via visualViewport API)
 * - Desktop (always returns keyboard closed)
 */
export function useKeyboard() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // Native: use Capacitor Keyboard plugin
      let cleanup: (() => void) | undefined;

      import("@capacitor/keyboard").then(({ Keyboard }) => {
        const showHandler = Keyboard.addListener("keyboardWillShow", (info) => {
          setIsKeyboardOpen(true);
          setKeyboardHeight(info.keyboardHeight);
        });

        const hideHandler = Keyboard.addListener("keyboardWillHide", () => {
          setIsKeyboardOpen(false);
          setKeyboardHeight(0);
        });

        cleanup = () => {
          showHandler.then((h) => h.remove());
          hideHandler.then((h) => h.remove());
        };
      });

      return () => {
        cleanup?.();
      };
    } else {
      // Web: use visualViewport API (works on mobile browsers)
      const viewport = window.visualViewport;
      if (!viewport) return;

      const handleResize = () => {
        // When keyboard opens, visualViewport.height shrinks
        const heightDiff = window.innerHeight - viewport.height;
        const open = heightDiff > 100; // Threshold to avoid false positives from browser chrome
        setIsKeyboardOpen(open);
        setKeyboardHeight(open ? heightDiff : 0);
      };

      viewport.addEventListener("resize", handleResize);
      viewport.addEventListener("scroll", handleResize);

      return () => {
        viewport.removeEventListener("resize", handleResize);
        viewport.removeEventListener("scroll", handleResize);
      };
    }
  }, []);

  return { isKeyboardOpen, keyboardHeight };
}
