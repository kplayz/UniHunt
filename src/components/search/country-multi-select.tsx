"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { COUNTRIES } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface CountryMultiSelectProps {
  selected: string[];
  onChange: (countries: string[]) => void;
}

export function CountryMultiSelect({ selected, onChange }: CountryMultiSelectProps) {
  const [open, setOpen] = useState(false);

  function toggleCountry(country: string) {
    if (selected.includes(country)) {
      onChange(selected.filter((c) => c !== country));
    } else {
      onChange([...selected, country]);
    }
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-auto min-h-9 w-full justify-between font-normal"
          >
            <span className="truncate text-left">
              {selected.length === 0
                ? "Select countries..."
                : `${selected.length} countr${selected.length === 1 ? "y" : "ies"} selected`}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search countries..." />
            <CommandList>
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {COUNTRIES.map((country) => (
                  <CommandItem
                    key={country}
                    value={country}
                    onSelect={() => toggleCountry(country)}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        selected.includes(country) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {country}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((country) => (
            <Badge key={country} variant="secondary" className="gap-1 pr-1">
              {country}
              <button
                type="button"
                onClick={() => toggleCountry(country)}
                className="rounded-full p-0.5 hover:bg-muted"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
