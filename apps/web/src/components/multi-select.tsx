"use client";

import { CheckIcon, ChevronDownIcon, PlusIcon } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Option = { label: string; value: string };

type Props = {
  placeholder?: string;
  searchPlaceholder?: string;
  options: Option[];
  onSelected(option: string): void;
  selected: string;
  onAdd(): void;
};

export default function MultiSelect(props: Props) {
  const id = useId();
  const [open, setOpen] = useState<boolean>(false);

  const option = useMemo(
    () => props.options?.find((option) => option.value === props.selected),
    [props.selected, props.options]
  );

  return (
    <div className="*:not-first:mt-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            role="combobox"
            aria-expanded={open}
            className="bg-background hover:bg-background border-input w-full justify-between px-3 font-light outline-offset-0 outline-none focus-visible:outline-[3px]"
          >
            <span className="truncate text-muted-foreground">
              {option?.label ?? props.placeholder ?? "Selecione"}
            </span>
            <ChevronDownIcon
              size={16}
              className="text-muted-foreground/80 shrink-0"
              aria-hidden="true"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="border-input w-full min-w-[var(--radix-popper-anchor-width)] p-0"
          align="start"
        >
          <Command>
            <CommandInput
              placeholder={props.searchPlaceholder ?? "Pesquisar..."}
            />
            <CommandList>
              <CommandEmpty>Nada encontrado.</CommandEmpty>
              <CommandGroup className="p-0">
                {props.options?.map((option) => (
                  <CommandItem
                    className="rounded-none text-xs p-3"
                    key={option.value}
                    value={option.value}
                    onSelect={(currentValue) => {
                      props.onSelected(
                        currentValue === props.selected ? "" : currentValue
                      );
                      setOpen(false);
                    }}
                  >
                    {option.label}
                    {props.selected === option.value && (
                      <CheckIcon size={16} className="ml-auto" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup className="p-0">
                <Button
                  variant="ghost"
                  onClick={() => {
                    props.onAdd();
                  }}
                  className="w-full text-sky-500 hover:bg-muted/20 bg-muted rounded-t-none rounded-b-md border-0 text-xs px-5 py-3 flex items-center gap-2 justify-start font-normal"
                >
                  <PlusIcon size={16} className="-ms-2" aria-hidden="true" />
                  <span>Adicionar</span>
                </Button>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
