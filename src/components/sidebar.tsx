"use client";

import { SearchInput } from "./search-input";
import { FilterSection } from "./filter-section";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heart, History } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterOption {
  id: string;
  label: string;
  count?: number;
  icon?: string;
}

interface SidebarProps {
  search: string;
  onSearchChange: (value: string) => void;
  categories: FilterOption[];
  selectedCategories: string[];
  onCategoriesChange: (selected: string[]) => void;
  countries: FilterOption[];
  selectedCountries: string[];
  onCountriesChange: (selected: string[]) => void;
  showFavorites: boolean;
  onShowFavoritesChange: (show: boolean) => void;
  showHistory: boolean;
  onShowHistoryChange: (show: boolean) => void;
  className?: string;
}

export function Sidebar({
  search,
  onSearchChange,
  categories,
  selectedCategories,
  onCategoriesChange,
  countries,
  selectedCountries,
  onCountriesChange,
  showFavorites,
  onShowFavoritesChange,
  showHistory,
  onShowHistoryChange,
  className,
}: SidebarProps) {
  return (
    <aside className={cn("flex flex-col", className)}>
      <div className="p-4">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Search channels..."
        />
      </div>

      <ScrollArea className="flex-1 px-4">
        <FilterSection
          title="Categories"
          options={categories}
          selected={selectedCategories}
          onChange={onCategoriesChange}
          searchable
        />

        <FilterSection
          title="Countries"
          options={countries}
          selected={selectedCountries}
          onChange={onCountriesChange}
          searchable
        />

        <div className="border-b border-border py-3">
          <div className="space-y-1">
            <button
              onClick={() => {
                onShowFavoritesChange(!showFavorites);
                if (!showFavorites) onShowHistoryChange(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent",
                showFavorites && "bg-accent"
              )}
            >
              <Heart className="h-4 w-4" />
              Favorites
            </button>

            <button
              onClick={() => {
                onShowHistoryChange(!showHistory);
                if (!showHistory) onShowFavoritesChange(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent",
                showHistory && "bg-accent"
              )}
            >
              <History className="h-4 w-4" />
              Watch History
            </button>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
