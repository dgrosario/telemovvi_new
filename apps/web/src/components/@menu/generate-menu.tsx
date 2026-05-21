// React Imports
import type { ReactNode } from "react";

// MUI Imports
import type { ChipProps } from "@mui/material/Chip";

// Type Imports
import type {
  VerticalMenuDataType,
  VerticalSectionDataType,
  VerticalSubMenuDataType,
  VerticalMenuItemDataType,
  HorizontalMenuDataType,
  HorizontalSubMenuDataType,
  HorizontalMenuItemDataType,
} from "./menuTypes";

// Component Imports
import {
  SubMenu as HorizontalSubMenu,
  MenuItem as HorizontalMenuItem,
} from "./horizontal-menu";
import {
  SubMenu as VerticalSubMenu,
  MenuItem as VerticalMenuItem,
  MenuSection,
} from "./vertical-menu";
import CustomChip from "../custom-chip";

// Generate a menu from the menu data array
export const GenerateVerticalMenu = ({
  menuData,
  onClick,
}: {
  menuData: VerticalMenuDataType[];
  onClick?: () => void;
}) => {
  // Hooks

  const renderMenuItems = (data: VerticalMenuDataType[]) => {
    // Use the map method to iterate through the array of menu data
    return data.map((item: VerticalMenuDataType, index) => {
      const menuSectionItem = item as VerticalSectionDataType;
      const subMenuItem = item as VerticalSubMenuDataType;
      const menuItem = item as VerticalMenuItemDataType;

      // Check if the current item is a section
      if (menuSectionItem.isSection) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { children, isSection, ...rest } = menuSectionItem;

        // If it is, return a MenuSection component and call generateMenu with the current menuSectionItem's children
        return (
          <MenuSection key={index} {...rest}>
            {children && renderMenuItems(children)}
          </MenuSection>
        );
      }

      // Check if the current item is a sub menu
      if (subMenuItem.children) {
        const { children, icon, prefix, suffix, ...rest } = subMenuItem;

        const Icon = icon ? <i className={icon} /> : null;

        const subMenuPrefix: ReactNode =
          prefix && (prefix as ChipProps).label ? (
            <CustomChip size="small" round="true" variant="filled" {...(prefix as ChipProps)} />
          ) : (
            (prefix as ReactNode)
          );

        const subMenuSuffix: ReactNode =
          suffix && (suffix as ChipProps).label ? (
            <CustomChip size="small" round="true" variant="filled" {...(suffix as ChipProps)} />
          ) : (
            (suffix as ReactNode)
          );

        // If it is, return a SubMenu component and call generateMenu with the current subMenuItem's children
        return (
          <VerticalSubMenu
            key={index}
            prefix={subMenuPrefix}
            suffix={subMenuSuffix}
            {...rest}
            {...(Icon && { icon: Icon })}
          >
            {children && renderMenuItems(children)}
          </VerticalSubMenu>
        );
      }

      // If the current item is neither a section nor a sub menu, return a MenuItem component
      const { label, icon, prefix, suffix, ...rest } = menuItem;

      // Localize the href

      const Icon = icon ? <i className={icon} /> : null;

      const menuItemPrefix: ReactNode =
        prefix && (prefix as ChipProps).label ? (
          <CustomChip size="small" round="true" variant="filled" {...(prefix as ChipProps)} />
        ) : (
          (prefix as ReactNode)
        );

      const menuItemSuffix: ReactNode =
        suffix && (suffix as ChipProps).label ? (
          <CustomChip size="small" round="true" variant="filled" {...(suffix as ChipProps)} />
        ) : (
          (suffix as ReactNode)
        );

      return (
        <VerticalMenuItem
          key={index}
          prefix={menuItemPrefix}
          suffix={menuItemSuffix}
          {...rest}
          href={menuItem.href}
          {...(Icon && { icon: Icon })}
          onClick={(e) => {
            if (window.location.pathname !== menuItem.href) {
              rest?.onClick?.(e);
              onClick?.();
            }
          }}
        >
          {label}
        </VerticalMenuItem>
      );
    });
  };

  return <>{renderMenuItems(menuData)}</>;
};

// Generate a menu from the menu data array
export const GenerateHorizontalMenu = ({
  menuData,
}: {
  menuData: HorizontalMenuDataType[];
}) => {
  // Hooks

  const renderMenuItems = (data: HorizontalMenuDataType[]) => {
    // Use the map method to iterate through the array of menu data
    return data.map((item: HorizontalMenuDataType, index) => {
      const subMenuItem = item as HorizontalSubMenuDataType;
      const menuItem = item as HorizontalMenuItemDataType;

      // Check if the current item is a sub menu
      if (subMenuItem.children) {
        const { children, icon, prefix, suffix, ...rest } = subMenuItem;

        const Icon = icon ? <i className={icon} /> : null;

        const subMenuPrefix: ReactNode =
          prefix && (prefix as ChipProps).label ? (
            <CustomChip size="small" round="true" variant="filled" {...(prefix as ChipProps)} />
          ) : (
            (prefix as ReactNode)
          );

        const subMenuSuffix: ReactNode =
          suffix && (suffix as ChipProps).label ? (
            <CustomChip size="small" round="true" variant="filled" {...(suffix as ChipProps)} />
          ) : (
            (suffix as ReactNode)
          );

        // If it is, return a SubMenu component and call generateMenu with the current subMenuItem's children
        return (
          <HorizontalSubMenu
            key={index}
            prefix={subMenuPrefix}
            suffix={subMenuSuffix}
            {...rest}
            {...(Icon && { icon: Icon })}
          >
            {children && renderMenuItems(children)}
          </HorizontalSubMenu>
        );
      }

      // If the current item is not a sub menu, return a MenuItem component
      const { label, icon, prefix, suffix, ...rest } = menuItem;

      // Localize the href

      const Icon = icon ? <i className={icon} /> : null;

      const menuItemPrefix: ReactNode =
        prefix && (prefix as ChipProps).label ? (
          <CustomChip size="small" round="true" variant="filled" {...(prefix as ChipProps)} />
        ) : (
          (prefix as ReactNode)
        );

      const menuItemSuffix: ReactNode =
        suffix && (suffix as ChipProps).label ? (
          <CustomChip size="small" round="true" variant="filled" {...(suffix as ChipProps)} />
        ) : (
          (suffix as ReactNode)
        );

      return (
        <HorizontalMenuItem
          key={index}
          prefix={menuItemPrefix}
          suffix={menuItemSuffix}
          {...rest}
          href={menuItem.href}
          {...(Icon && { icon: Icon })}
        >
          {label}
        </HorizontalMenuItem>
      );
    });
  };

  return <>{renderMenuItems(menuData)}</>;
};
