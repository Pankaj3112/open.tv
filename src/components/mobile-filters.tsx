"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import { SearchInput } from "./search-input";
import { FilterSection } from "./filter-section";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heart, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface FilterOption {
  id: string;
  label: string;
  count?: number;
  icon?: string;
}

interface MobileFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  categories: FilterOption[];
  selectedCategories: string[];
  onCategoriesChange: (selected: string[]) => void;
  countries: FilterOption[];
  selectedCountries: string[];
  onCountriesChange: (selected: string[]) => void;
  languages: FilterOption[];
  selectedLanguages: string[];
  onLanguagesChange: (selected: string[]) => void;
  showFavorites: boolean;
  onShowFavoritesChange: (show: boolean) => void;
  showHistory: boolean;
  onShowHistoryChange: (show: boolean) => void;
  activeFilterCount: number;
}

export function MobileFilters({
  search,
  onSearchChange,
  categories,
  selectedCategories,
  onCategoriesChange,
  countries,
  selectedCountries,
  onCountriesChange,
  languages,
  selectedLanguages,
  onLanguagesChange,
  showFavorites,
  onShowFavoritesChange,
  showHistory,
  onShowHistoryChange,
  activeFilterCount,
}: MobileFiltersProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Filter className="mr-2 h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <div className="mt-4">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Search channels..."
          />
        </div>

        <ScrollArea className="mt-4 h-[calc(80vh-12rem)]">
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

          <FilterSection
            title="Languages"
            options={languages}
            selected={selectedLanguages}
            onChange={onLanguagesChange}
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

        <div className="absolute bottom-0 left-0 right-0 border-t bg-background p-4">
          <Button className="w-full" onClick={() => setOpen(false)}>
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
