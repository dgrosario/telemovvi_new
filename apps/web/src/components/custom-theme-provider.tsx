"use client";

import defaultCoreTheme from "@/utils/theme";
import { ChildrenType, SystemMode } from "@/utils/types";
import {
  Direction,
  ThemeProvider,
  createTheme,
  darken,
  lighten,
} from "@mui/material/styles";
import { deepmerge } from "@mui/utils";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import stylisRTLPlugin from "stylis-plugin-rtl";
import themeConfig from "@/utils/themeConfig";
import CssBaseline from "@mui/material/CssBaseline";

type Props = ChildrenType & {
  direction: Direction;
  systemMode: SystemMode;
};

export const CustomThemeProvider = (props: Props) => {
  const { children, direction, systemMode } = props;

  const primaryColor = "#5a73c8";

  const newTheme = {
    colorSchemes: {
      light: {
        palette: {
          primary: {
            main: primaryColor,
            light: lighten(primaryColor as string, 0.2),
            dark: darken(primaryColor as string, 0.1),
          },
        },
      },
      dark: {
        palette: {
          primary: {
            main: primaryColor,
            light: lighten(primaryColor as string, 0.2),
            dark: darken(primaryColor as string, 0.1),
          },
        },
      },
    },
    cssVariables: {
      colorSchemeSelector: "data",
    },
  };

  const coreTheme = deepmerge(defaultCoreTheme("light", "ltr"), newTheme);

  const theme = createTheme(coreTheme);

  return (
    <AppRouterCacheProvider
      options={{
        prepend: true,
        ...(direction === "rtl" && {
          key: "rtl",
          stylisPlugins: [stylisRTLPlugin],
        }),
      }}
    >
      <ThemeProvider
        theme={theme}
        defaultMode={systemMode}
        modeStorageKey={`${themeConfig.templateName.toLowerCase().split(" ").join("-")}-mui-template-mode`}
      >
        <>
          <CssBaseline />
          {children}
        </>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
};
