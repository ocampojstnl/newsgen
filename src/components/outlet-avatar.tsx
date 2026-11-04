import Image from "next/image";
import { outletKeyForName } from "@/lib/catalog";
import { cn } from "@/lib/utils";

function logoFor(name: string): string | null {
  const key = outletKeyForName(name);
  return key ? `/logos/${key}.png` : null;
}

function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words.length === 1 ? words[0].slice(0, 2).toUpperCase() : (words[0][0] + words[1][0]).toUpperCase();
}

function hueOf(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

/** The outlet's logo, or a coloured initials tile for publishers without one. */
export function OutletAvatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  const logo = logoFor(name);
  if (logo) {
    return (
      <span aria-hidden className={cn("grid shrink-0 place-items-center overflow-hidden rounded-md bg-white ring-1 ring-white/10", className)} style={{ width: size, height: size }}>
        <Image src={logo} alt="" width={size} height={size} unoptimized className="size-full object-contain" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-md font-semibold text-white ring-1 ring-white/10", className)}
      style={{ width: size, height: size, fontSize: size * 0.36, background: `oklch(0.52 0.13 ${hueOf(name)})` }}
    >
      {initials(name)}
    </span>
  );
}
