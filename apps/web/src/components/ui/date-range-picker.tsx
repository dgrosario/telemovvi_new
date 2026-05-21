"use client";

import CustomTextField from "@/components/custom-text-field";
import { Stack } from "@mui/material";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import React, { useState, useEffect } from "react";

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
}: DateRangePickerProps) {
  const [startValue, setStartValue] = useState(startDate);
  const [endValue, setEndValue] = useState(endDate);
  const [isEditingStart, setIsEditingStart] = useState(false);
  const [isEditingEnd, setIsEditingEnd] = useState(false);

  const formatDateForInput = (dateStr: string): string => {
    if (!dateStr) return "";
    try {
      const date = parse(dateStr, "yyyy-MM-dd", new Date());
      return isValid(date) ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "";
    } catch {
      return "";
    }
  };

  const formatDateForState = (dateStr: string): string => {
    if (!dateStr) return "";
    try {
      const date = parse(dateStr, "dd/MM/yyyy", new Date());
      return isValid(date) ? format(date, "yyyy-MM-dd") : "";
    } catch {
      return "";
    }
  };

  useEffect(() => {
    if (!isEditingStart) {
      const formatted = formatDateForInput(startDate);
      setStartValue(formatted || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, isEditingStart]);

  useEffect(() => {
    if (!isEditingEnd) {
      const formatted = formatDateForInput(endDate);
      setEndValue(formatted || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endDate, isEditingEnd]);

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setStartValue(newValue);
    setIsEditingStart(true);

    if (newValue.length === 10) {
      const formatted = formatDateForState(newValue);
      if (formatted) {
        onChange(formatted, endDate);
        setIsEditingStart(false);
      }
    } else if (newValue === "") {
      onChange("", endDate);
      setIsEditingStart(false);
    }
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setEndValue(newValue);
    setIsEditingEnd(true);

    if (newValue.length === 10) {
      const formatted = formatDateForState(newValue);
      if (formatted) {
        onChange(startDate, formatted);
        setIsEditingEnd(false);
      }
    } else if (newValue === "") {
      onChange(startDate, "");
      setIsEditingEnd(false);
    }
  };

  const handleStartBlur = () => {
    setIsEditingStart(false);
    if (startValue.length > 0 && startValue.length < 10) {
      setStartValue(formatDateForInput(startDate) || "");
    }
  };

  const handleEndBlur = () => {
    setIsEditingEnd(false);
    if (endValue.length > 0 && endValue.length < 10) {
      setEndValue(formatDateForInput(endDate) || "");
    }
  };

  return (
    <Stack direction="row" spacing={2}>
      <CustomTextField
        label="Data inicial"
        placeholder="dd/mm/aaaa"
        value={isEditingStart ? startValue : (formatDateForInput(startDate) || startValue)}
        onChange={handleStartChange}
        onBlur={handleStartBlur}
        fullWidth
        size="small"
        type="text"
        inputProps={{
          maxLength: 10,
        }}
        sx={{ "& .MuiInputBase-root": { height: 40 } }}
      />
      <CustomTextField
        label="Data final"
        placeholder="dd/mm/aaaa"
        value={isEditingEnd ? endValue : (formatDateForInput(endDate) || endValue)}
        onChange={handleEndChange}
        onBlur={handleEndBlur}
        fullWidth
        size="small"
        type="text"
        inputProps={{
          maxLength: 10,
        }}
        sx={{ "& .MuiInputBase-root": { height: 40 } }}
      />
    </Stack>
  );
}
