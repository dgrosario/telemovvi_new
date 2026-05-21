"use client";

import { connectChannel } from "@/app/actions/channels";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "react-toastify";

export function InstagramCallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const processedRef = useRef(false);

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    const state = searchParams.get("state"); // channelId

    if (state && !processedRef.current) {
      if (error) {
        processedRef.current = true;
        // Check if we are in a popup
        if (window.opener) {
          window.opener.postMessage(
            { type: "INSTAGRAM_CODE", error, error_description: errorDescription, state },
            window.location.origin
          );
          window.close();
          return;
        }
        
        toast.error(errorDescription || error || "Erro ao conectar com Instagram");
        return;
      }

      if (code) {
        processedRef.current = true;

        // Check if we are in a popup
        if (window.opener) {
          window.opener.postMessage(
            { type: "INSTAGRAM_CODE", code, state },
            window.location.origin
          );
          window.close();
          return;
        }

        // Fallback: If not in a popup (e.g. direct nav), process as before
        const toastId = toast.loading("Conectando Instagram...");

        const handleConnect = async () => {
          try {
            const redirectUri = `${window.location.origin}/channels`;
            
            await connectChannel({
              id: state,
              type: "instagram",
              inputPayload: { 
                code,
                redirectUri 
              },
            });

            toast.update(toastId, {
              render: "Instagram conectado com sucesso!",
              type: "success",
              isLoading: false,
              autoClose: 3000,
            });

            queryClient.invalidateQueries({ queryKey: ["list-channels"] });
            
            // Clean URL
            const newParams = new URLSearchParams(searchParams.toString());
            newParams.delete("code");
            newParams.delete("state");
            router.replace(`/channels?${newParams.toString()}`);
          } catch (error) {
            console.error(error);
            toast.update(toastId, {
              render: error instanceof Error ? error.message : "Falha ao conectar Instagram.",
              type: "error",
              isLoading: false,
              autoClose: 3000,
            });
            processedRef.current = false;
          }
        };

        handleConnect();
      }
    }
  }, [searchParams, router, queryClient]);

  return null;
}
