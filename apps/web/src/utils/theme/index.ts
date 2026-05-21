import type { Theme } from "@mui/material/styles";
import type { SystemMode, Skin } from "@/utils/types";

import overrides from "./overrides";
import colorSchemes from "./colorSchemes";
import spacing from "./spacing";
import shadows from "./shadows";
import customShadows from "./customShadows";
import typography from "./typography";

const theme = (mode: SystemMode, direction: Theme["direction"]): Theme => {
  return {
    direction,
    components: overrides("default" as Skin),
    colorSchemes: colorSchemes("default" as Skin),
    ...spacing,
    shape: {
      borderRadius: 6,
      customBorderRadius: {
        xs: 2,
        sm: 4,
        md: 6,
        lg: 8,
        xl: 10,
      },
    } as any,
    shadows: shadows(mode),
    typography: typography(),
    customShadows: customShadows(mode),
    mainColorChannels: {
      light: "47 43 61",
      dark: "225 222 245",
      lightShadow: "47 43 61",
      darkShadow: "19 17 32",
    },
  } as unknown as Theme;
};

export default theme;
