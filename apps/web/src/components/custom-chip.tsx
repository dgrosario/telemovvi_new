"use client";
import { styled } from "@mui/material";
import type { ChipProps } from "@mui/material/Chip";
import MuiChip from "@mui/material/Chip";

export type CustomChipProps = Omit<ChipProps, "variant"> & {
  round?: "true" | "false";
  variant: "filled" | "outlined" | "tonal";
};

const Chip = styled(MuiChip)<CustomChipProps>(({ round }) => {
  return {
    ...(round === "true" && {
      borderRadius: 500,
    }),
  };
});

const CustomChip = (props: CustomChipProps) => (
  <Chip {...props} variant={props.variant as any} />
);

export default CustomChip;
