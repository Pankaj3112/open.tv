"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";

interface FilterOption {
  id: string;
  label: string;
  count?: number;
  icon?: string;
}

interface FilterSectionProps {
  title: string;
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  searchable?: boolean;
}

export function FilterSection({
  title,
  options,
  selected,
  onChange,
  searchable = false,
}: FilterSectionProps) {
  const [search, setSearch] = useState("");

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const toggleOption = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="border-b border-border pb-3 overflow-hidden flex flex-col h-full">
      <div className="py-2 text-sm font-medium shrink-0">{title}</div>

      <div className="space-y-2 flex-1 flex flex-col min-h-0">
          {searchable && (
            <div className="relative shrink-0">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={`Search ${title.toLowerCase()}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-7 text-xs"
              />
            </div>
          )}

          <div className="overflow-y-auto overflow-x-hidden flex-1">
            <div className="space-y-1">
              {filteredOptions.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent max-w-full"
                >
                  <Checkbox
                    checked={selected.includes(option.id)}
                    onCheckedChange={() => toggleOption(option.id)}
                    className="shrink-0"
                  />
                  {option.icon && <span className="shrink-0">{option.icon}</span>}
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
    </div>
  );
}
