import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls to top on every route change, EXCEPT when navigating back
 * via the browser back button (popstate). This ensures:
 * - Opening a thread always starts at the top
 * - Going back to the feed restores the previous scroll position
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // The browser sets history.scrollRestoration to 'auto' by default,
    // which can interfere. We handle it manually.
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    // Always scroll to top when pathname changes.
    // For back-navigation, the AgoraPage itself will restore scroll position
    // after its content has loaded — this initial scroll-to-top prevents
    // the "random position" issue when opening threads.
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
