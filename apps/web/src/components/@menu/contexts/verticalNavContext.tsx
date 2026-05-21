"use client";

// React Imports
import { createContext, useCallback, useEffect, useMemo, useState } from "react";

// Type Imports
import type { ChildrenType } from "../types";

const STORAGE_KEY = "sidebar-collapsed-state";

function getStoredState(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      return stored === "true";
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

function saveState(isCollapsed: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(isCollapsed));
  } catch {
    // Ignore storage errors
  }
}

export type VerticalNavState = {
  width?: number;
  collapsedWidth?: number;
  isCollapsed?: boolean;
  isHovered?: boolean;
  isToggled?: boolean;
  isScrollWithContent?: boolean;
  isBreakpointReached?: boolean;
  isPopoutWhenCollapsed?: boolean;
  collapsing?: boolean; // for internal use only
  expanding?: boolean; // for internal use only
  transitionDuration?: number;
};

export type VerticalNavContextProps = VerticalNavState & {
  updateVerticalNavState: (values: VerticalNavState) => void;
  collapseVerticalNav: (value?: VerticalNavState["isCollapsed"]) => void;
  hoverVerticalNav: (value?: VerticalNavState["isHovered"]) => void;
  toggleVerticalNav: (value?: VerticalNavState["isToggled"]) => void;
};

const VerticalNavContext = createContext({} as VerticalNavContextProps);

export const VerticalNavProvider = ({ children }: ChildrenType) => {
  // States
  const [verticalNavState, setVerticalNavState] = useState<VerticalNavState>({
    isCollapsed: true,
  });

  useEffect(() => {
    const stored = getStoredState();
    if (stored !== null) {
      setVerticalNavState((prev) => ({ ...prev, isCollapsed: stored }));
    }
  }, []);

  // Hooks
  const updateVerticalNavState = useCallback(
    (values: Partial<VerticalNavState>) => {
      setVerticalNavState((prevState) => {
        const newIsCollapsed = values.isCollapsed ?? prevState.isCollapsed;
        if (values.isCollapsed !== undefined) {
          saveState(values.isCollapsed);
        }
        return {
          ...prevState,
          ...values,
          collapsing: values.isCollapsed === true,
          expanding: values.isCollapsed === false,
        };
      });
    },
    []
  );

  const collapseVerticalNav = useCallback((value?: boolean) => {
    setVerticalNavState((prevState) => {
      const newIsCollapsed = value !== undefined ? Boolean(value) : !Boolean(prevState?.isCollapsed);
      saveState(newIsCollapsed);
      return {
        ...prevState,
        isHovered: value !== undefined && false,
        isCollapsed: newIsCollapsed,
        collapsing: value === true,
        expanding: value !== true,
      };
    });
  }, []);

  const hoverVerticalNav = useCallback((value?: boolean) => {
    setVerticalNavState((prevState) => ({
      ...prevState,
      isHovered:
        value !== undefined ? Boolean(value) : !Boolean(prevState?.isHovered),
    }));
  }, []);

  const toggleVerticalNav = useCallback((value?: boolean) => {
    setVerticalNavState((prevState) => ({
      ...prevState,
      isToggled:
        value !== undefined ? Boolean(value) : !Boolean(prevState?.isToggled),
    }));
  }, []);

  const verticalNavProviderValue = useMemo(
    () => ({
      ...verticalNavState,
      updateVerticalNavState,
      collapseVerticalNav,
      hoverVerticalNav,
      toggleVerticalNav,
    }),
    [
      verticalNavState,
      updateVerticalNavState,
      collapseVerticalNav,
      hoverVerticalNav,
      toggleVerticalNav,
    ]
  );

  return (
    <VerticalNavContext.Provider value={verticalNavProviderValue}>
      {children}
    </VerticalNavContext.Provider>
  );
};

export default VerticalNavContext;
