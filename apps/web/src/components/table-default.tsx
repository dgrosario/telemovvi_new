import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import React, { useRef, useState } from "react";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import ModalConfirmDelete from "./modal-confirm-delete";

export type Column<T> = {
  label?: string;
  key: keyof T;
  cell?: (value: T[keyof T], row: T) => React.ReactNode;
  width?: number;
  sortable?: boolean;
  stopPropagation?: boolean;
};

export type BulkAction<T> = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: "primary" | "destructive" | "outline" | "secondary" | "ghost" | "light";
  onClick: (selectedItems: T[]) => void | Promise<void>;
  confirm?: {
    title: string;
    content: string;
    resourceName: string;
  };
};

export type TableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  pageIndex?: number;
  totalPages?: number;
  canSelect?: boolean;
  noPagination?: boolean;
  onPageChange?: (pageIndex: number) => void;
  onRemove?: (selecteds: T[]) => Promise<void> | void;
  bulkActions?: BulkAction<T>[];
  onRowClick?: (row: T) => void;
};

export function TableDefault<T extends { id: string }>({
  columns,
  rows,
  pageIndex = 0,
  totalPages = 0,
  canSelect = false,
  noPagination = false,
  onPageChange,
  onRemove,
  bulkActions = [],
  onRowClick,
}: TableProps<T>) {
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const headerCheckboxRef = useRef<HTMLButtonElement>(null);

  const goToFirst = () => onPageChange?.(0);
  const goToPrev = () => onPageChange?.(Math.max(pageIndex - 1, 0));
  const goToNext = () => onPageChange?.(pageIndex + 1);
  const goToLast = () => {
    if (totalPages) onPageChange?.(totalPages - 1);
  };

  const handleSort = (column: Column<T>) => {
    if (!column.sortable) return;
    let direction: "asc" | "desc" = "asc";
    if (sortColumn === column.key)
      direction = sortDirection === "asc" ? "desc" : "asc";
    setSortColumn(column.key);
    setSortDirection(direction);
  };

  const isAllSelected =
    rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const isSomeSelected =
    rows.some((r) => selectedIds.has(r.id)) && !isAllSelected;

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (isAllSelected) rows.forEach((r) => newSet.delete(r.id));
      else rows.forEach((r) => newSet.add(r.id));
      return newSet;
    });
  };

  const toggleRowSelection = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
  };

  const getSelectedItems = () => rows.filter((r) => selectedIds.has(r.id));

  const handleBulkAction = async (action: BulkAction<T>) => {
    await action.onClick(getSelectedItems());
    setSelectedIds(new Set());
  };

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <div
        data-hidden={!selectedIds.size}
        className="bg-[#F1F4F9] flex items-center gap-2 py-1.5 border-b"
      >
        <span className="-me-1 ms-3 inline-flex h-5 max-h-full items-center bg-transparent px-1 font-[inherit] text-xs font-light">
          {selectedIds.size} registro(s) selecionado(s)
        </span>
        {bulkActions.map((action) =>
          action.confirm ? (
            <ModalConfirmDelete
              key={action.id}
              onConfirm={() => handleBulkAction(action)}
              resourceName={action.confirm.resourceName}
              dialogTitle={action.confirm.title}
              dialogContent={action.confirm.content}
            >
              <Button
                className="rounded h-7 shadow-none border !text-sm gap-1"
                type="button"
                variant={action.variant ?? "outline"}
              >
                {action.icon}
                {action.label}
              </Button>
            </ModalConfirmDelete>
          ) : (
            <Button
              key={action.id}
              className="rounded h-7 shadow-none border !text-sm gap-1"
              type="button"
              variant={action.variant ?? "outline"}
              onClick={() => handleBulkAction(action)}
            >
              {action.icon}
              {action.label}
            </Button>
          )
        )}
        {onRemove && (
          <ModalConfirmDelete
            onConfirm={async () => {
              await onRemove?.(getSelectedItems());
              setSelectedIds(new Set());
            }}
            resourceName="Excluir"
          >
            <Button
              className="rounded text-primary h-7 shadow-none border !text-sm"
              type="button"
              variant="outline"
            >
              Excluir
            </Button>
          </ModalConfirmDelete>
        )}
      </div>
      <div className="min-w-0 overflow-x-auto">
      <Table className="table-fixed !z-0 min-w-[720px]">
        <TableHeader className="bg-[#F1F4F9]">
          <TableRow className="hover:bg-transparent">
            {canSelect && (
              <TableHead
                style={{ width: "50px", height: "35px" }}
                className="text-center"
              >
                <Checkbox
                  checked={isSomeSelected ? "indeterminate" : isAllSelected}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
            )}
            {columns.map((column) => (
              <TableHead
                key={String(column.key)}
                style={{
                  width: column.width ? column.width : "auto",
                }}
                className="!h-2 text-sm text-[#323232] cursor-pointer select-none"
                onClick={() => handleSort(column)}
              >
                <div className="flex font-normal items-center gap-1">
                  {column.label}
                  {column.sortable &&
                    sortColumn === column.key &&
                    (sortDirection === "asc" ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    ))}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length ? (
            [...rows]
              .sort((rowA, rowB) => {
                if (!sortColumn) return 0;

                const a = rowA[sortColumn];
                const b = rowB[sortColumn];

                if (typeof a === "string" && typeof b === "string") {
                  return sortDirection === "asc"
                    ? a.localeCompare(b)
                    : b.localeCompare(a);
                }

                if (typeof a === "number" && typeof b === "number") {
                  return sortDirection === "asc" ? a - b : b - a;
                }

                if (a > b) return sortDirection === "asc" ? 1 : -1;
                if (a < b) return sortDirection === "asc" ? -1 : 1;
                return 0;
              })
              .map((row) => {
                const isSelected = selectedIds.has(row.id);
                return (
                  <TableRow
                    key={row.id}
                    className={cn(
                      "text-sm cursor-pointer",
                      isSelected && "bg-yellow-50 hover:bg-yellow-100"
                    )}
                    onClick={() => {
                      if (onRowClick) {
                        onRowClick(row);
                      } else if (canSelect) {
                        toggleRowSelection(row.id);
                      }
                    }}
                  >
                    {canSelect && (
                      <TableCell className="w-10 text-center">
                        <Checkbox
                          ref={headerCheckboxRef}
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => toggleRowSelection(row.id)}
                        />
                      </TableCell>
                    )}
                    {columns.map((column) => (
                      <TableCell
                        key={String(column.key) + row.id}
                        onClick={(e) => {
                          if (column.stopPropagation) e.stopPropagation();
                        }}
                        className="last:py-0 font-normal"
                      >
                        {column.cell
                          ? column.cell(row[column.key], row)
                          : String(row[column.key] ?? "")}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length + (canSelect ? 1 : 0)}
                className="h-24 text-center"
              >
                Nenhum resultado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </div>

      <footer
        data-hidden={noPagination}
        className="flex items-center mt-2 pr-10 pb-10 justify-between gap-8"
      >
        <div className="flex grow justify-end whitespace-nowrap text-sm text-muted-foreground">
          <p aria-live="polite">
            <span className="text-foreground">Página {pageIndex + 1}</span> de{" "}
            <span className="text-foreground">
              {totalPages === 0 ? 1 : totalPages}
            </span>
          </p>
        </div>

        <div className="flex select-none gap-1">
          <Button
            disabled={pageIndex === 0}
            variant="outline"
            onClick={goToFirst}
          >
            <ChevronFirst size={16} />
          </Button>
          <Button
            disabled={pageIndex === 0}
            variant="outline"
            onClick={goToPrev}
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            disabled={pageIndex === totalPages - 1}
            variant="outline"
            onClick={goToNext}
          >
            <ChevronRight size={16} />
          </Button>
          <Button
            disabled={pageIndex === totalPages - 1}
            variant="outline"
            onClick={goToLast}
          >
            <ChevronLast size={16} />
          </Button>
        </div>
      </footer>
    </div>
  );
}
