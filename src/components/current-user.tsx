"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/lib/types";

const CurrentUserContext = createContext<SessionUser | null>(null);

export const CurrentUserProvider = CurrentUserContext.Provider;

export function useCurrentUser(): SessionUser {
  const user = useContext(CurrentUserContext);
  if (!user) throw new Error("useCurrentUser must be used inside the signed-in app.");
  return user;
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0]).toUpperCase();
}
