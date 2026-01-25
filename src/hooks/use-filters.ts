"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

export interface Filters {
  search: string;
  countries: string[];
  categories: string[];
  playing: string | null;
}

export function useFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Memoize filter values to prevent unnecessary re-renders
  const search = searchParams.get("q") || "";
  const countriesParam = searchParams.get("countries") || "";
  const categoriesParam = searchParams.get("categories") || "";
  const playing = searchParams.get("playing");

  const filters: Filters = useMemo(() => ({
    search,
    countries: countriesParam ? countriesParam.split(",").filter(Boolean) : [],
    categories: categoriesParam ? categoriesParam.split(",").filter(Boolean) : [],
    playing,
  }), [search, countriesParam, categoriesParam, playing]);

  const updateFilters = useCallback(
    (updates: Partial<Filters>) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.search !== undefined) {
        if (updates.search) {
          params.set("q", updates.search);
        } else {
          params.delete("q");
        }
      }

      if (updates.countries !== undefined) {
        if (updates.countries.length) {
          params.set("countries", updates.countries.join(","));
        } else {
          params.delete("countries");
        }
      }

      if (updates.categories !== undefined) {
        if (updates.categories.length) {
          params.set("categories", updates.categories.join(","));
        } else {
          params.delete("categories");
        }
      }

      if (updates.playing !== undefined) {
        if (updates.playing) {
          params.set("playing", updates.playing);
        } else {
          params.delete("playing");
        }
      }

      const newUrl = params.toString()
        ? `${pathname}?${params.toString()}`
        : pathname;

      router.push(newUrl, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams();
    // Preserve playing state when clearing filters
    const playing = searchParams.get("playing");
    if (playing) {
      params.set("playing", playing);
    }
    const newUrl = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname;
    router.push(newUrl, { scroll: false });
  }, [searchParams, router, pathname]);

  return {
    filters,
    updateFilters,
    clearFilters,
  };
}
