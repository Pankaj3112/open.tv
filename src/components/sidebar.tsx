"use client";

import { SearchInput } from "./search-input";
import { FilterSection } from "./filter-section";
import { Heart, History, ArrowLeft, Trash2, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

interface FilterOption {
  id: string;
  label: string;
  count?: number;
  icon?: string;
}

type SidebarMode = "browse" | "favorites" | "history";

interface SidebarProps {
  mode: SidebarMode;
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
  onBackToBrowse: () => void;
  favoriteCount: number;
  historyCount: number;
  favoritesSort: "recent" | "most-watched" | "alphabetical";
  onFavoritesSortChange: (sort: "recent" | "most-watched" | "alphabetical") => void;
  historyTimeFilter: "today" | "week" | "all";
  onHistoryTimeFilterChange: (filter: "today" | "week" | "all") => void;
  onClearFavorites: () => void;
  onClearHistory: () => void;
  probingEnabled?: boolean;
  onProbingEnabledChange?: (enabled: boolean) => void;
  className?: string;
}

export function Sidebar({
  mode,
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
  onBackToBrowse,
  favoriteCount,
  historyCount,
  favoritesSort,
  onFavoritesSortChange,
  historyTimeFilter,
  onHistoryTimeFilterChange,
  onClearFavorites,
  onClearHistory,
  probingEnabled,
  onProbingEnabledChange,
  className,
}: SidebarProps) {
  const [showClearFavoritesDialog, setShowClearFavoritesDialog] = useState(false);
  const [showClearHistoryDialog, setShowClearHistoryDialog] = useState(false);

  if (mode === "favorites") {
    return (
      <aside className={cn("flex flex-col", className)}>
        {/* Title */}
        <div className="px-4 pt-4 pb-3 shrink-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Heart className="h-5 w-5" />
            Favorites ({favoriteCount})
          </h2>
        </div>

        {/* Controls */}
        <div className="flex-1 overflow-y-auto px-4 space-y-6">
          {/* Sort options */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Sort by</h3>
            <RadioGroup value={favoritesSort} onValueChange={onFavoritesSortChange}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="recent" id="sort-recent" />
                <Label htmlFor="sort-recent" className="text-sm cursor-pointer">Recently added</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="most-watched" id="sort-most-watched" />
                <Label htmlFor="sort-most-watched" className="text-sm cursor-pointer">Most watched</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="alphabetical" id="sort-alphabetical" />
                <Label htmlFor="sort-alphabetical" className="text-sm cursor-pointer">A-Z</Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="shrink-0 border-t border-border p-4">
          <div className="space-y-1">
            <button
              onClick={() => setShowClearFavoritesDialog(true)}
              disabled={favoriteCount === 0}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-4 w-4" />
              Clear all favorites
            </button>
            <button
              onClick={onBackToBrowse}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Browse
            </button>
          </div>
        </div>

        {/* Clear Favorites Dialog */}
        <AlertDialog open={showClearFavoritesDialog} onOpenChange={setShowClearFavoritesDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all favorites?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove all {favoriteCount} channels from your favorites. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onClearFavorites();
                  setShowClearFavoritesDialog(false);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Clear all
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </aside>
    );
  }

  if (mode === "history") {
    return (
      <aside className={cn("flex flex-col", className)}>
        {/* Title */}
        <div className="px-4 pt-4 pb-3 shrink-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <History className="h-5 w-5" />
            Watch History ({historyCount})
          </h2>
        </div>

        {/* Controls */}
        <div className="flex-1 overflow-y-auto px-4 space-y-6">
          {/* Time filter */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Show</h3>
            <RadioGroup value={historyTimeFilter} onValueChange={onHistoryTimeFilterChange}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="today" id="filter-today" />
                <Label htmlFor="filter-today" className="text-sm cursor-pointer">Today</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="week" id="filter-week" />
                <Label htmlFor="filter-week" className="text-sm cursor-pointer">This week</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="filter-all" />
                <Label htmlFor="filter-all" className="text-sm cursor-pointer">All time</Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="shrink-0 border-t border-border p-4">
          <div className="space-y-1">
            <button
              onClick={() => setShowClearHistoryDialog(true)}
              disabled={historyCount === 0}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-4 w-4" />
              Clear history
            </button>
            <button
              onClick={onBackToBrowse}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Browse
            </button>
          </div>
        </div>

        {/* Clear History Dialog */}
        <AlertDialog open={showClearHistoryDialog} onOpenChange={setShowClearHistoryDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear watch history?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove all {historyCount} channels from your watch history. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onClearHistory();
                  setShowClearHistoryDialog(false);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Clear all
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </aside>
    );
  }

  // Browse mode (default)
  return (
    <aside className={cn("flex flex-col", className)}>
      {/* Search - Fixed at top */}
      <div className="p-4 shrink-0">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Search channels..."
        />
      </div>

      {/* Filters - Take remaining space equally */}
      <div className="flex-1 flex flex-col overflow-hidden px-4 min-h-0">
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
          <FilterSection
            title="Categories"
            options={categories}
            selected={selectedCategories}
            onChange={onCategoriesChange}
            searchable
          />
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
          <FilterSection
            title="Countries"
            options={countries}
            selected={selectedCountries}
            onChange={onCountriesChange}
            searchable
          />
        </div>
      </div>

      {/* Favorites, History & Stream Check - Fixed at bottom */}
      <div className="shrink-0 border-t border-border p-4">
        <div className="space-y-1">
          {/* Stream Check Toggle */}
          {onProbingEnabledChange && (
            <div className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4" />
                <Label htmlFor="probing-toggle" className="text-sm cursor-pointer">
                  Check streams
                </Label>
              </div>
              <Switch
                id="probing-toggle"
                size="sm"
                checked={probingEnabled}
                onCheckedChange={onProbingEnabledChange}
              />
            </div>
          )}

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
    </aside>
  );
}
