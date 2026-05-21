"use client";

import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Button,
  ButtonGroup,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
} from "@mui/material";
import {
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns";
import React from "react";

interface DateRangeFilterProps {
  dateType: "creation" | "lastMessage";
  dateStart: string;
  dateEnd: string;
  onDateTypeChange: (type: "creation" | "lastMessage") => void;
  onDateRangeChange: (start: string, end: string) => void;
}

export function DateRangeFilter({
  dateType,
  dateStart,
  dateEnd,
  onDateTypeChange,
  onDateRangeChange,
}: DateRangeFilterProps) {
  const applyPreset = (preset: "today" | "week" | "month" | "currentMonth") => {
    let start: Date;
    let end: Date;

    switch (preset) {
      case "today":
        start = startOfDay(new Date());
        end = endOfDay(new Date());
        break;
      case "week":
        start = startOfDay(subDays(new Date(), 7));
        end = endOfDay(new Date());
        break;
      case "month":
        start = startOfDay(subDays(new Date(), 30));
        end = endOfDay(new Date());
        break;
      case "currentMonth":
        start = startOfMonth(new Date());
        end = endOfMonth(new Date());
        break;
    }

    onDateRangeChange(
      format(start, "yyyy-MM-dd"),
      format(end, "yyyy-MM-dd")
    );
  };

  return (
    <Stack spacing={2}>
      <RadioGroup
        value={dateType}
        onChange={(e) =>
          onDateTypeChange(e.target.value as "creation" | "lastMessage")
        }
      >
        <FormControlLabel
          value="creation"
          control={<Radio size="small" />}
          label="Data de criação da conversa"
          sx={{ "& .MuiTypography-root": { fontSize: "0.875rem" } }}
        />
        <FormControlLabel
          value="lastMessage"
          control={<Radio size="small" />}
          label="Data da última mensagem"
          sx={{ "& .MuiTypography-root": { fontSize: "0.875rem" } }}
        />
      </RadioGroup>

      <ButtonGroup size="small" variant="outlined" fullWidth>
        <Button onClick={() => applyPreset("today")}>Hoje</Button>
        <Button onClick={() => applyPreset("week")}>7 dias</Button>
        <Button onClick={() => applyPreset("month")}>30 dias</Button>
        <Button onClick={() => applyPreset("currentMonth")}>Mês</Button>
      </ButtonGroup>

      <DateRangePicker
        startDate={dateStart}
        endDate={dateEnd}
        onChange={onDateRangeChange}
      />
    </Stack>
  );
}
