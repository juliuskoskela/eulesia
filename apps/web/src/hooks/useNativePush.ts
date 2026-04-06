import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { queryKeys } from "./useApi";
import { api } from "../lib/api";

export function useNativePush() {
  const { isAuthenticated, currentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !isAuthenticated || !currentUser)
      return;
    if (registeredRef.current) return;

    const cleanupFns: (() => void)[] = [];

    async function setupPush() {
      const { PushNotifications } = await import(
        "@capacitor/push-notifications"
      );

      // Check and request permission
      let permission = await PushNotifications.checkPermissions();
      if (permission.receive === "prompt") {
        permission = await PushNotifications.requestPermissions();
      }

      if (permission.receive !== "granted") {
        // Permission not granted — silently bail
        return;
      }

      // Listen for registration success
      const regListener = await PushNotifications.addListener(
        "registration",
        async (token) => {
          // Token received — register with backend
          const platform = Capacitor.getPlatform() as "android" | "ios";
          try {
            await api.registerDeviceToken(token.value, platform);
            registeredRef.current = true;
            // Store token for logout cleanup
            localStorage.setItem("fcm_token", token.value);
          } catch (err) {
            console.error("Failed to register device token:", err);
          }
        },
      );
      cleanupFns.push(() => regListener.remove());

      // Listen for registration errors
      const errListener = await PushNotifications.addListener(
        "registrationError",
        (err) => {
          console.error("Push registration error:", err);
        },
      );
      cleanupFns.push(() => errListener.remove());

      // Handle notification received while app is in foreground
      const receivedListener = await PushNotifications.addListener(
        "pushNotificationReceived",
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
          queryClient.invalidateQueries({
            queryKey: queryKeys.notificationUnreadCount,
          });
        },
      );
      cleanupFns.push(() => receivedListener.remove());

      // Handle notification tap (app opened from notification)
      const actionListener = await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action) => {
          const data = action.notification.data;
          if (data?.link) {
            navigate(data.link);
          }
          queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
          queryClient.invalidateQueries({
            queryKey: queryKeys.notificationUnreadCount,
          });
        },
      );
      cleanupFns.push(() => actionListener.remove());

      // Register with FCM/APNs
      await PushNotifications.register();
    }

    setupPush();

    return () => {
      cleanupFns.forEach((fn) => fn());
    };
  }, [isAuthenticated, currentUser, navigate, queryClient]);
}
