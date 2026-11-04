"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import { useClearView } from "@/lib/clear-view";
import { Toaster } from "@/components/ui/sonner";

export function ThemeRoot({ children }: { children: React.ReactNode }) {
  // Clear view also stops animations, which are hard to follow with blurry vision.
  const [clearView] = useClearView();
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion={clearView ? "always" : "user"}>{children}</MotionConfig>
      <Toaster position="bottom-right" />
    </ThemeProvider>
  );
}
