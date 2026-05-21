import { clsx, type ClassValue } from "clsx";
import {
  differenceInDays,
  format,
  isToday,
  isYesterday,
  differenceInCalendarDays,
} from "date-fns";
import { pt } from "date-fns/locale/pt";
import { twMerge } from "tailwind-merge";

export function formatLastMessagemTime(date: Date | null): string {
  if (!date) return "";
  const now = new Date();

  if (isToday(date)) {
    return format(date, "HH:mm", { locale: pt });
  }

  if (isYesterday(date)) {
    return "Ontem";
  }

  const diffDias = differenceInCalendarDays(now, date);

  if (diffDias <= 6) {
    return format(date, "EEE", { locale: pt });
  }

  return format(date, "dd/MM/yyyy", { locale: pt });
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const focusInput = [
  "focus:ring-2",
  "focus:ring-blue-200",
  "focus:border-blue-500",
];

export const focusRing = [
  "outline outline-offset-2 outline-0 focus-visible:outline-2",
  "outline-blue-500",
];

export const hasErrorInput = ["ring-2", "border-red-500", "ring-red-200"];

export function formatDay(date: Date) {
  if (isToday(date)) {
    return "Hoje";
  }

  if (isYesterday(date)) {
    return "Ontem";
  }

  if (differenceInDays(date, new Date()) < 7) {
    return format(date, "eeee", { locale: pt });
  }

  return format(date, "eee, dd 'de' MMM.", { locale: pt });
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(1, "0")}:${String(s).padStart(2, "0")}`;
}

export function normalizeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
