import { Heart, History, Search } from "lucide-react";

interface EmptyStateProps {
  mode: "browse" | "favorites" | "history";
}

export function EmptyState({ mode }: EmptyStateProps) {
  if (mode === "favorites") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Heart className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <p className="text-lg font-medium">No favorites yet</p>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          Click the heart icon on any channel to add it to your favorites
        </p>
      </div>
    );
  }

  if (mode === "history") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <History className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <p className="text-lg font-medium">No watch history</p>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          Start watching channels to see your history here
        </p>
      </div>
    );
  }

  // Browse mode
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Search className="h-16 w-16 text-muted-foreground/50 mb-4" />
      <p className="text-lg font-medium">No channels found</p>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm">
        Try adjusting your filters or search query
      </p>
    </div>
  );
}
