// MUI Imports
import { Skin } from "@/utils/types";
import type { Theme } from "@mui/material";

const drawer = (skin: Skin): Theme["components"] => ({
  MuiDrawer: {
    defaultProps: {
      ...(skin === "bordered" && {
        PaperProps: {
          elevation: 0,
        },
      }),
    },
    styleOverrides: {
      paper: {
        ...(skin !== "bordered" && {
          boxShadow: "var(--mui-customShadows-lg)",
        }),
        margin: "10px",
        height: "-webkit-fill-available",
        borderRadius: "10px",
      },
    },
  },
});

export default drawer;
