"use client";

import { Chip } from "@mui/material";
import type { ProcessedData } from "./types";

type Props = {
  data: ProcessedData;
};

export function ValidationSummary({ data }: Props) {
  if (data.total === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Chip
        icon={<i className="tabler-check text-sm" />}
        label={`${data.valid.length} válidos`}
        color="success"
        size="small"
      />
      {data.invalid.length > 0 && (
        <Chip
          icon={<i className="tabler-x text-sm" />}
          label={`${data.invalid.length} inválidos`}
          color="error"
          size="small"
        />
      )}
      {data.emptyPhone.length > 0 && (
        <Chip
          icon={<i className="tabler-phone-off text-sm" />}
          label={`${data.emptyPhone.length} sem telefone`}
          color="warning"
          size="small"
        />
      )}
      {data.duplicateCount > 0 && (
        <Chip
          icon={<i className="tabler-copy text-sm" />}
          label={`${data.duplicateCount} duplicados removidos`}
          color="default"
          size="small"
        />
      )}
    </div>
  );
}
