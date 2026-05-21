"use client";
import { Sidebar } from "@/components/ui/sidebar";
import { styled, useTheme } from "@mui/material";
import { User } from "@omnichannel/core/domain/entities/user";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import * as React from "react";
import { GenerateVerticalMenu } from "./@menu/generate-menu";
import useVerticalNav from "./@menu/hooks/useVerticalNav";
import menuItemStyles from "./@menu/menu-item-styles";
import menuSectionStyles from "./@menu/menu-section-styles";
import { VerticalMenuDataType } from "./@menu/menuTypes";
import navigationCustomStyles from "./@menu/navigation-custom-styles";
import VerticalNav, { Menu, NavHeader, NavFooter } from "./@menu/vertical-menu";
import { LoadingComponent } from "./loading";
import { PolicyName } from "@omnichannel/core/domain/services/permissions";
import { NavUser } from "./nav-user";

const StyledBoxForShadow = styled("div")(({ theme }) => ({
  top: 60,
  left: -8,
  zIndex: 2,
  opacity: 0,
  position: "absolute",
  pointerEvents: "none",
  width: "calc(100% + 15px)",
  height: theme.mixins.toolbar.minHeight,
  transition: "opacity .15s ease-in-out",
  background: `linear-gradient(var(--mui-palette-background-paper) ${
    theme.direction === "rtl" ? "95%" : "5%"
  }, rgb(var(--mui-palette-background-paperChannel) / 0.85) 30%, rgb(var(--mui-palette-background-paperChannel) / 0.5) 65%, rgb(var(--mui-palette-background-paperChannel) / 0.3) 75%, transparent)`,
  "&.scrolled": {
    opacity: 1,
  },
}));

const createMenuItems: (
  user: User.Raw,
  permissions: Set<PolicyName>,
) => VerticalMenuDataType[] = (user, permissions) => {
  const hasPermission = (perms: PolicyName[]) =>
    perms.some((p) => permissions.has(p));

  const topLevelItems = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: "tabler-chart-bar",
      active: hasPermission(["list:all-conversations"]),
    },
    {
      label: "Atendimentos",
      href: "/chat",
      icon: "tabler-message",
      active: hasPermission([
        "list:all-conversations",
        "list:conversation",
        "send:message",
      ]),
    },
    {
      label: "Clientes",
      href: "/clients",
      icon: "tabler-user-check",
      active: hasPermission(["manage:partners"]),
    },
    {
      label: "Modelos do Whatsapp",
      icon: "tabler-template",
      href: "/templates/whatsapp",
      active: hasPermission(["manage:templates", "list:templates"]),
    },
    {
      label: "Mensagens Rápidas",
      href: "/quick-messages",
      icon: "tabler-bolt",
      active: hasPermission([
        "view:quick-messages",
        "create:quick-messages",
        "manage:quick-messages",
      ]),
    },
    {
      label: "Fluxos",
      href: "/flows",
      icon: "tabler-git-branch",
      active: hasPermission(["manage:flows"]),
    },
    {
      label: "Campanhas",
      href: "/campaigns",
      icon: "tabler-speakerphone",
      active: hasPermission(["list:campaigns"]),
    },
  ];

  const adminItems = [
    {
      label: "Usuários e Perfis",
      icon: "tabler-users",
      href: "/settings/users",
      active: hasPermission(["manage:users", "list:users"]),
    },
    {
      label: "Variáveis",
      href: "/settings/variables",
      icon: "tabler-code",
      active: hasPermission(["manage:templates"]),
    },
    {
      label: "Calculadora",
      href: "/settings/calculator",
      icon: "tabler-calculator",
      active: hasPermission(["manage:calculator-settings"]),
    },
    {
      label: "Canais",
      href: "/channels",
      icon: "tabler-plug-connected",
      active: hasPermission(["manage:connections"]),
    },
    {
      label: "Setores",
      href: "/sectors",
      icon: "tabler-folders",
      active: hasPermission(["manage:sectors"]),
    },
    {
      label: "Etiquetas",
      href: "/settings/labels",
      icon: "tabler-tag",
      active: hasPermission(["manage:labels", "list:labels"]),
    },
  ];

  const filteredTopLevel = topLevelItems
    .filter((i) => i.active)
    .map((i) => ({
      label: i.label,
      icon: i.icon,
      href: i.href,
    }));

  const filteredAdmin = adminItems
    .filter((i) => i.active)
    .map((i) => ({
      label: i.label,
      icon: i.icon,
      href: i.href,
    }));

  const result: VerticalMenuDataType[] = [...filteredTopLevel];

  if (filteredAdmin.length > 0) {
    result.push({
      label: "Administração",
      icon: "tabler-briefcase",
      children: filteredAdmin,
    });
  }

  return result;
};

export function AppSidebar(
  props: React.ComponentProps<typeof Sidebar> & {
    user: User.Raw;
    permissions: PolicyName[];
    workspaceSelected: {
      workspaces: { id: string; name: string }[];
      workspace: { id: string; name: string };
    };
  },
) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = React.useState(false);
  const loadingTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const verticalNavOptions = useVerticalNav();
  const shadowRef = React.useRef(null);
  const theme = useTheme();

  const clearLoadingTimeout = React.useCallback(() => {
    if (!loadingTimeoutRef.current) return;
    clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = null;
  }, []);

  const startNavigationLoading = React.useCallback(() => {
    setLoading(true);
    clearLoadingTimeout();
    loadingTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      loadingTimeoutRef.current = null;
    }, 5000);
  }, [clearLoadingTimeout]);

  React.useEffect(() => {
    setLoading(false);
    clearLoadingTimeout();
  }, [pathname, searchParams, clearLoadingTimeout]);

  React.useEffect(() => {
    return () => {
      clearLoadingTimeout();
    };
  }, [clearLoadingTimeout]);

  const menuData = React.useMemo(
    () => createMenuItems(props.user, new Set(props.permissions)),
    [props.user, props.permissions],
  );

  const ScrollWrapper = "div";

  return (
    <>
      {loading && <LoadingComponent />}
      <VerticalNav
        customStyles={navigationCustomStyles(verticalNavOptions, theme)}
        width={260}
        collapsedWidth={71}
      >
        <div className="flex flex-col h-full">
          <ScrollWrapper className="flex-1 overflow-y-auto flex flex-col">
            <Menu
              popoutMenuOffset={{ mainAxis: 23 }}
              menuItemStyles={menuItemStyles(verticalNavOptions, theme)}
              renderExpandedMenuItemIcon={{
                icon: <i className="tabler-circle text-xs" />,
              }}
              menuSectionStyles={menuSectionStyles(verticalNavOptions, theme)}
            >
              <NavHeader>
                <Link className="min-w-[40px] flex-1" href={"/"}>
                  <Image width={1000} height={700} alt="logo" src="/icon.png" />
                </Link>
              </NavHeader>
              <StyledBoxForShadow ref={shadowRef} />
              <GenerateVerticalMenu
                onClick={startNavigationLoading}
                menuData={menuData}
              />
            </Menu>
            {props.permissions.includes("manage:meta-settings") && (
              <div className="border-t border-gray-200 py-3">
                <Link
                  href="/admin/meta-settings"
                  onClick={(e) => {
                    // Se já estiver na página, não faz nada
                    if (pathname === "/admin/meta-settings") {
                      e.preventDefault();
                      return;
                    }
                    startNavigationLoading();
                  }}
                  className={`flex items-center text-sm text-gray-700 hover:bg-gray-100 transition-colors rounded-lg py-2 ${
                    !verticalNavOptions.isCollapsed
                      ? "px-3 mx-3"
                      : "justify-center mx-auto"
                  } ${pathname === "/admin/meta-settings" ? "bg-gray-100" : ""}`}
                >
                  <i
                    className="tabler-brand-meta"
                    style={{
                      fontSize: "1.375rem",
                      marginInlineEnd: !verticalNavOptions.isCollapsed
                        ? "16px"
                        : "0",
                    }}
                  />
                  {!verticalNavOptions.isCollapsed && (
                    <span>Configurações</span>
                  )}
                </Link>
              </div>
            )}
          </ScrollWrapper>
          <div className="border-t border-gray-200 py-3">
            <NavUser
              user={props.user}
              workspaceSelected={props.workspaceSelected}
              permissions={props.permissions}
            />
          </div>
        </div>
      </VerticalNav>
    </>
  );
}
