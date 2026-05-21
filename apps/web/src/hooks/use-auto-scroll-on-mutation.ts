import { useEffect, useRef } from "react";

export function useAutoScrollOnMutation({
  smooth = false,
  offset = 100,
}: {
  smooth?: boolean;
  offset?: number;
} = {}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const shouldAutoScroll = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onScroll = () => {
      const isNearBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < offset;
      shouldAutoScroll.current = isNearBottom;
    };

    el.addEventListener("scroll", onScroll);

    const observer = new MutationObserver(() => {
      if (shouldAutoScroll.current) {
        el.scrollTo({
          top: el.scrollHeight,
          behavior: smooth ? "smooth" : "auto",
        });
      }
    });

    observer.observe(el, { childList: true, subtree: true });

    return () => {
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [smooth, offset]);

  return ref;
}
