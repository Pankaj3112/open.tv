"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
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
  defaultExpanded?: boolean;
}

export function FilterSection({
  title,
  options,
  selected,
  onChange,
  searchable = false,
  defaultExpanded = true,
}: FilterSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const displayOptions = showAll
    ? filteredOptions
    : filteredOptions.slice(0, 10);
  const hasMore = filteredOptions.length > 10;

  const toggleOption = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="border-b border-border pb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between py-2 text-sm font-medium hover:text-foreground/80"
      >
        <span>{title}</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {searchable && (
            <div className="relative">
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

          <div className="max-h-48 overflow-y-auto">
            <div className="space-y-1">
              {displayOptions.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={selected.includes(option.id)}
                    onCheckedChange={() => toggleOption(option.id)}
                  />
                  {option.icon && <span>{option.icon}</span>}
                  <span className="flex-1 truncate">{option.label}</span>
                  {option.count !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      ({option.count})
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {hasMore && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Show {filteredOptions.length - 10} more...
            </button>
          )}
        </div>
      )}
    </div>
  );
}
