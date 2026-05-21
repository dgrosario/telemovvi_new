"use client";

import { CustomThemeProvider } from "@/components/custom-theme-provider";
import { GlobalLoader } from "@/components/global-loader";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import { NuqsAdapter } from "nuqs/adapters/next/app";

function isAuthorizationError(error: unknown): boolean {
  if (error && typeof error === "object" && "name" in error) {
    return error.name === "NotAuthorized";
  }
  return false;
}

function isServerActionError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message?.toLowerCase() || "";
    return (
      message.includes("server action") ||
      message.includes("failed to find server action")
    );
  }
  return false;
}

function handleServerActionError(): void {
  toast.info("Aplicacao atualizada. Recarregando...");
  setTimeout(() => window.location.reload(), 1500);
}

export function Providers({ children }: React.PropsWithChildren) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error) => {
              if (isAuthorizationError(error)) {
                return false;
              }
              return failureCount < 3;
            },
          },
          mutations: {
            onError: (error) => {
              if (isServerActionError(error)) {
                handleServerActionError();
              }
            },
          },
        },
      })
  );

  return (
    <NuqsAdapter>
      <CustomThemeProvider direction="ltr" systemMode="light">
        <QueryClientProvider client={client}>
          {children}
          <ToastContainer style={{ zIndex: 2000, pointerEvents: "auto" }} />
          <GlobalLoader />
        </QueryClientProvider>
      </CustomThemeProvider>
    </NuqsAdapter>
  );
}
