"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { Spinner } from "./ui/spinner";

export function GlobalLoader() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (prevPath.current !== pathname) {
      setLoading(true);
      prevPath.current = pathname;

      requestAnimationFrame(() => {
        setLoading(false);
      });
    }
  }, [pathname]);

  if (!loading) return null;

  return (
    <div className="fixed flex-col gap-4 inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <Spinner size="xl" />
      <span className="animate-pulse text-gray-600 text-sm">Carregando...</span>
    </div>
  );
}
