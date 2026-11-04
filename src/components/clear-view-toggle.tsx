"use client";

import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClearView } from "@/lib/clear-view";
import { cn } from "@/lib/utils";

/** Turns Clear view on and off. Shows its name on wide screens so it is easy to find. */
export function ClearViewToggle({ className }: { className?: string }) {
  const [on, setOn] = useClearView();
  return (
    <Button
      variant={on ? "default" : "ghost"}
      size="sm"
      aria-pressed={on}
      onClick={() => setOn(!on)}
      title={on ? "Turn off Clear view" : "Clear view: larger text and stronger contrast for blurry vision"}
      className={cn("gap-1.5", className)}
    >
      <Eye />
      <span className="hidden sm:inline">Clear view</span>
    </Button>
  );
}
