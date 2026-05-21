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
import { SidebarTrigger } from "@/components/ui/sidebar";
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
              <div>
                <AppSidebar
                  permissions={permissions}
                  user={user}
                  workspaceSelected={workspaceSelected}
                />
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#F9FAFC] min-h-dvh">
              <header className="sticky top-0 z-20 flex h-14 items-center border-b bg-white px-3 md:hidden">
                <SidebarTrigger className="!min-w-10 !w-10 !h-10 !rounded-md !text-gray-700 hover:!bg-gray-100">
                  <i className="tabler-menu-2 text-xl text-gray-700" />
                </SidebarTrigger>
              </header>
              <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
                {children}
              </main>
            </div>
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
