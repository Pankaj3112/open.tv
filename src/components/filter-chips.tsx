"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface FilterChip {
  type: "category" | "country" | "language";
  id: string;
  label: string;
  icon?: string;
}

interface FilterChipsProps {
  chips: FilterChip[];
  totalCount: number;
  onRemove: (type: FilterChip["type"], id: string) => void;
  onClearAll: () => void;
}

export function FilterChips({
  chips,
  totalCount,
  onRemove,
  onClearAll,
}: FilterChipsProps) {
  if (chips.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Showing {totalCount.toLocaleString()} channels
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">
        Showing {totalCount.toLocaleString()} channels:
      </span>

      {chips.map((chip) => (
        <Badge
          key={`${chip.type}-${chip.id}`}
          variant="secondary"
          className="flex items-center gap-1 pr-1"
        >
          {chip.icon && <span>{chip.icon}</span>}
          {chip.label}
          <button
            onClick={() => onRemove(chip.type, chip.id)}
            className="ml-1 rounded-full p-0.5 hover:bg-muted"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="h-6 text-xs"
      >
        Clear all
      </Button>
    </div>
  );
}
