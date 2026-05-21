import { useQueryState, parseAsStringLiteral } from "nuqs";

export type TabValue = "users" | "roles";

const TAB_VALUES = ["users", "roles"] as const;

export function useUsersAndRolesTab() {
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TAB_VALUES).withDefault("users")
  );

  return {
    tab: tab as TabValue,
    setTab,
    isUsersTab: tab === "users",
    isRolesTab: tab === "roles",
  };
}
