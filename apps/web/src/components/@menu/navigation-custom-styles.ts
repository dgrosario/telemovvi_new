// MUI Imports
import type { Theme } from "@mui/material/styles";
import { menuClasses, verticalNavClasses } from "./utils/menuClasses";
import { VerticalNavState } from "./contexts/verticalNavContext";

const navigationCustomStyles = (
  verticalNavOptions: VerticalNavState,
  theme: Theme
) => {
  // Vars
  const { collapsedWidth, isCollapsed, isHovered, transitionDuration } =
    verticalNavOptions;

  const collapsedHovered = isCollapsed && isHovered;
  const collapsedNotHovered = isCollapsed && !isHovered;

  return {
    color: "var(--mui-palette-text-primary)",
    [`& .${verticalNavClasses.header}`]: {
      paddingBlock: theme.spacing(5),
      paddingInline: theme.spacing(5.5, 4),

      ...(collapsedNotHovered && {
        paddingInline: theme.spacing(((collapsedWidth as number) - 35) / 8),
        "& a": {
          transform: `translateX(-${22 - ((collapsedWidth as number) - 29) / 2}px)`,
        },
      }),
      "& a": {
        transition: `transform ${transitionDuration}ms ease`,
      },
    },
    [`& .${verticalNavClasses.container}`]: {
      transition: theme.transitions.create(
        ["inline-size", "inset-inline-start", "box-shadow"],
        {
          duration: transitionDuration,
          easing: "ease-in-out",
        }
      ),
      borderColor: "transparent",
      boxShadow: "var(--mui-customShadows-sm)",
      '[data-skin="bordered"] &': {
        boxShadow: "none",
        ...(collapsedHovered && {
          boxShadow: "var(--mui-customShadows-sm)",
        }),
        borderColor: "var(--mui-palette-divider)",
      },
    },
    [`& .${menuClasses.root}`]: {
      paddingBlock: theme.spacing(1),
      paddingInline: theme.spacing(3),
    },
    [`& .${verticalNavClasses.backdrop}`]: {
      backgroundColor: "gray",
    },
  };
};

export default navigationCustomStyles;
