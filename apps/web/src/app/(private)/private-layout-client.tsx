"use client";

import { VerticalNavProvider } from "@/components/@menu/contexts/verticalNavContext";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SocketProvider } from "@/providers/socket-provider";
import { SocketEventsInitializer } from "@/providers/socket-events-initializer";
import { NotificationsInitializer } from "@/providers/notifications-initializer";
import { UserPermissionsProvider } from "@/providers/user-permissions-provider";
import ModalRegisterClients from "./clients/modal-register-clients";
import { ModalQRCodeConnect } from "@/components/modal-qrcode-connect";
import { ContactDetailsDrawer } from "@/components/contact-details";
import { FloatingNotificationButton } from "@/components/floating-notification-button";
import { User } from "@omnichannel/core/domain/entities/user";
import { PolicyName } from "@omnichannel/core/domain/services/permissions";
import { useEffect, useState } from "react";

type PrivateLayoutClientProps = {
  children: React.ReactNode;
  workspaceId: string;
  user: User.Raw;
  permissions: PolicyName[];
  blockedSectorsForContactDetails: string[];
  workspaceSelected: any;
};

export function PrivateLayoutClient({
  children,
  workspaceId,
  user,
  permissions,
  blockedSectorsForContactDetails,
  workspaceSelected,
}: PrivateLayoutClientProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <SocketProvider workspaceId={workspaceId}>
      <UserPermissionsProvider
        user={user}
        permissions={permissions}
        blockedSectorsForContactDetails={blockedSectorsForContactDetails}
      >
        <SocketEventsInitializer />
        <NotificationsInitializer />
        <VerticalNavProvider>
          <SidebarProvider>
            {isMounted && (
              <div className="hidden md:block">
                <AppSidebar
                  permissions={permissions}
                  user={user}
                  workspaceSelected={workspaceSelected}
                />
              </div>
            )}
            <main className="w-full overflow-auto bg-[#F9FAFC]" style={{ height: '100dvh' }}>
              {children}
            </main>
            <ModalRegisterClients />
            <ModalQRCodeConnect />
            <ContactDetailsDrawer />
            <FloatingNotificationButton />
          </SidebarProvider>
        </VerticalNavProvider>
      </UserPermissionsProvider>
    </SocketProvider>
  );
}
