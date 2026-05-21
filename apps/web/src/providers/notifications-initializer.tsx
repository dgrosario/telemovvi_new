"use client";

import { useEffect, useRef } from "react";
import {
  getNotificationSettings,
  getUnreadNotificationCount,
} from "@/app/actions/notifications";
import { useNotificationStore } from "@/hooks/use-notification-store";

export function NotificationsInitializer() {
  const initialized = useRef(false);
  const initializeFromServer = useNotificationStore(
    (state) => state.initializeFromServer
  );
  const setFloatingButtonEnabled = useNotificationStore(
    (state) => state.setFloatingButtonEnabled
  );

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    Promise.allSettled([getNotificationSettings({}), getUnreadNotificationCount({})])
      .then(([settingsResult, countResult]) => {
        if (settingsResult.status === "fulfilled") {
          const settings = settingsResult.value;
          if (settings[0]) {
            setFloatingButtonEnabled(settings[0].showFloatingButton);
          }
        }

        if (countResult.status === "fulfilled") {
          const [result, error] = countResult.value;
          if (!error && result) {
            initializeFromServer(result.unreadCount);
          }
        }
      })
      .catch(() => {});
  }, [initializeFromServer, setFloatingButtonEnabled]);

  return null;
}
