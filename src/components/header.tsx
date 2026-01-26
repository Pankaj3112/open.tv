"use client";

import { Github, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileFilters } from "./mobile-filters";

interface FilterOption {
  id: string;
  label: string;
  count?: number;
  icon?: string;
}

interface HeaderProps {
  // Mobile filter props (passed through)
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
  activeFilterCount: number;
}

export function Header(props: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Tv className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">open.tv</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile filters - only visible on mobile */}
          <div className="lg:hidden">
            <MobileFilters
              search={props.search}
              onSearchChange={props.onSearchChange}
              categories={props.categories}
              selectedCategories={props.selectedCategories}
              onCategoriesChange={props.onCategoriesChange}
              countries={props.countries}
              selectedCountries={props.selectedCountries}
              onCountriesChange={props.onCountriesChange}
              showFavorites={props.showFavorites}
              onShowFavoritesChange={props.onShowFavoritesChange}
              showHistory={props.showHistory}
              onShowHistoryChange={props.onShowHistoryChange}
              activeFilterCount={props.activeFilterCount}
            />
          </div>

          <Button variant="ghost" size="icon" asChild>
            <a
              href="https://github.com/Pankaj3112/open.tv"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-5 w-5" />
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}
