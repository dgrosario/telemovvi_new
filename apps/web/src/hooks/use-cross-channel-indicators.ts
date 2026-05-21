"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { getCrossChannelIndicators } from "@/app/actions/conversations";
import { useServerActionQuery } from "./server-action-hooks";
import { useConversationStore } from "./use-conversation-store";

type CrossChannelStatus = "recent" | "stale";

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;
const ACTIVE_STATUSES = ["open", "waiting", "expired"] as const;

type IndicatorRow = {
  contactId: string;
  newestOtherChannelMessageAt: number;
};

function isIndicatorRow(value: unknown): value is IndicatorRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<IndicatorRow>;
  return typeof row.contactId === "string" && typeof row.newestOtherChannelMessageAt === "number";
}

function extractIndicatorRows(data: unknown): IndicatorRow[] {
  if (!data) return [];

  if (Array.isArray(data)) {
    if (data.every(isIndicatorRow)) {
      return data;
    }

    const [first] = data;
    if (Array.isArray(first) && first.every(isIndicatorRow)) {
      return first;
    }
  }

  return [];
}

export function useCrossChannelIndicators() {
  const activeConversationIds = useConversationStore(
    useShallow((state) => {
      const ids: string[] = [];
      for (const status of ACTIVE_STATUSES) {
        for (const convId of state.idsByStatus[status]) {
          ids.push(convId);
        }
      }
      return ids;
    })
  );
  const conversationsById = useConversationStore((state) => state.byId);

  const { contactIds, fallbackIndicatorMap } = useMemo(() => {
    const uniqueContactIds = new Set<string>();
    const countsByContactId = new Map<string, number>();
    const countsByContactValue = new Map<string, number>();
    const contactIdsByValue = new Map<string, Set<string>>();
    const seenConversationIds = new Set<string>();

    for (const convId of activeConversationIds) {
      if (seenConversationIds.has(convId)) continue;
      seenConversationIds.add(convId);

      const conv = conversationsById[convId];
      if (!conv || conv.conversationType !== "external") continue;

      const contact = conv.contact;
      if (!contact?.id) continue;

      uniqueContactIds.add(contact.id);
      countsByContactId.set(contact.id, (countsByContactId.get(contact.id) ?? 0) + 1);

      const normalizedValue = contact.value?.trim().toLowerCase();
      if (normalizedValue) {
        countsByContactValue.set(
          normalizedValue,
          (countsByContactValue.get(normalizedValue) ?? 0) + 1
        );

        const idsForValue = contactIdsByValue.get(normalizedValue) ?? new Set<string>();
        idsForValue.add(contact.id);
        contactIdsByValue.set(normalizedValue, idsForValue);
      }
    }

    const fallbackMap = new Map<string, CrossChannelStatus>();

    for (const [contactId, count] of countsByContactId) {
      if (count >= 2) {
        fallbackMap.set(contactId, "recent");
      }
    }

    for (const [valueKey, count] of countsByContactValue) {
      if (count < 2) continue;
      const idsForValue = contactIdsByValue.get(valueKey);
      if (!idsForValue) continue;

      for (const contactId of idsForValue) {
        fallbackMap.set(contactId, "recent");
      }
    }

    return {
      contactIds: Array.from(uniqueContactIds),
      fallbackIndicatorMap: fallbackMap,
    };
  }, [activeConversationIds, conversationsById]);

  const { data, error, isError } = useServerActionQuery(getCrossChannelIndicators, {
    input: { contactIds },
    queryKey: ["cross-channel-indicators", contactIds],
    enabled: contactIds.length > 0,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const serverIndicatorMap = useMemo(() => {
    const map = new Map<string, CrossChannelStatus>();
    const indicators = extractIndicatorRows(data);
    if (!indicators.length) return map;

    const nowSeconds = Date.now() / 1000;

    for (const item of indicators) {
      const ageSeconds = nowSeconds - item.newestOtherChannelMessageAt;
      map.set(
        item.contactId,
        ageSeconds <= SEVEN_DAYS_SECONDS ? "recent" : "stale"
      );
    }
    return map;
  }, [data]);

  const indicatorMap = useMemo(() => {
    const map = new Map<string, CrossChannelStatus>(fallbackIndicatorMap);
    for (const [contactId, status] of serverIndicatorMap) {
      map.set(contactId, status);
    }
    return map;
  }, [fallbackIndicatorMap, serverIndicatorMap]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !isError) return;
    console.debug("[useCrossChannelIndicators] server action failed; using local fallback when possible", error);
  }, [error, isError]);

  const getIndicator = useCallback(
    (contactId: string | undefined): CrossChannelStatus | null => {
      if (!contactId) return null;
      return indicatorMap.get(contactId) ?? null;
    },
    [indicatorMap]
  );

  return { getIndicator };
}
