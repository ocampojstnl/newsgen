"use client";

import { motion } from "motion/react";
import { Newspaper } from "lucide-react";
import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="NewsGen home">
      <motion.div
        whileHover={{ rotate: -8, scale: 1.05 }}
        className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-1 ring-white/10"
      >
        <Newspaper className="size-4" />
      </motion.div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">NewsGen</div>
          <div className="text-[10px] text-muted-foreground">Sourced news desk</div>
        </div>
      )}
    </Link>
  );
}
