// MUI Imports
import themeConfig from "@/utils/themeConfig";
import type { Theme } from "@mui/material/styles";

// Config Imports

const buttonGroup: Theme["components"] = {
  MuiButtonGroup: {
    defaultProps: {
      disableRipple: themeConfig.disableRipple,
    },
  } as any,
};

export default buttonGroup;
