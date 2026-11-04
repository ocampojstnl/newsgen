"use client";

import { motion } from "motion/react";
import { ArrowRight, Eye, EyeOff, Loader2, Newspaper } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useClearView } from "@/lib/clear-view";
import { cn } from "@/lib/utils";

export type TapeItem = { outlet: string; title: string };

/** Password sign-in. Always dark: it uses fixed colours, not the theme. */
export function LoginForm({ tape }: { tape: TapeItem[] }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [clearView, setClearView] = useClearView();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (response.ok) {
        // An article sent from the bookmark while signed out travels in the link's fragment.
        router.replace(window.location.hash ? `/import${window.location.hash}` : "/");
        router.refresh();
        return;
      }
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Sign in failed. Please try again.");
    } catch {
      setError("The app could not be reached. Please try again.");
    }
    setAttempt((current) => current + 1);
    setPassword("");
    setBusy(false);
  };

  return (
    <div className="flex min-h-dvh flex-col overflow-hidden bg-[#050506] font-sans text-[#ededef] [color-scheme:dark]">
      {tape.length > 0 && (
        <div className="flex h-9 shrink-0 items-center overflow-hidden border-b border-white/[0.07] font-mono text-[11px] whitespace-nowrap">
          <div className="tape flex w-max">
            {[...tape, ...tape].map((item, index) => (
              <span key={index} className="flex items-center gap-2 px-4" aria-hidden={index >= tape.length}>
                <span className="text-[#a5a8ff]">{item.outlet}</span>
                <span className="text-white/70">{item.title}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <motion.form
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          onSubmit={submit}
          noValidate
          className="w-full max-w-[340px]"
        >
          <div className="mb-10 flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-md bg-[#6366f1] text-white ring-1 ring-white/15">
              <Newspaper className="size-3.5" />
            </span>
            <span className="text-sm font-semibold tracking-tight">NewsGen</span>
          </div>

          <h1 className="text-[22px] leading-tight font-semibold tracking-tight">Sign in to your news desk</h1>
          <p className="mt-1.5 text-sm text-white/45">Enter your username and password to continue.</p>

          <motion.div
            key={attempt}
            animate={error ? { x: [0, -6, 6, -4, 4, 0] } : {}}
            transition={{ duration: 0.35 }}
            className="mt-8"
          >
            <input
              id="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              placeholder="Username"
              aria-label="Username"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                if (error) setError(null);
              }}
              aria-invalid={!!error}
              className={cn(
                "mb-3 h-11 w-full rounded-[7px] border bg-white/[0.03] px-3.5 text-[15px] text-white transition-[border-color,box-shadow] outline-none placeholder:text-white/30",
                error
                  ? "border-[#ef4444]/60 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]"
                  : "border-white/[0.12] focus:border-white/40 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.06)]",
              )}
            />
            <div className="relative">
              <input
                id="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Password"
                aria-label="Password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError(null);
                }}
                aria-invalid={!!error}
                aria-describedby={error ? "login-error" : undefined}
                className={cn(
                  "h-11 w-full rounded-[7px] border bg-white/[0.03] px-3.5 pr-11 text-[15px] text-white transition-[border-color,box-shadow] outline-none placeholder:text-white/30",
                  error
                    ? "border-[#ef4444]/60 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]"
                    : "border-white/[0.12] focus:border-white/40 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.06)]",
                )}
              />
              <button
                type="button"
                onClick={() => setShow((current) => !current)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-[5px] text-white/35 transition-colors hover:text-white/80"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p id="login-error" role="alert" className={cn("mt-2 min-h-5 text-[13px] text-[#f87171]", !error && "invisible")}>
              {error ?? " "}
            </p>
          </motion.div>

          <button
            type="submit"
            disabled={busy || !password || !username}
            className={cn(
              "mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-[7px] text-sm font-medium transition-[background-color,color,transform]",
              password && username ? "bg-white text-black hover:bg-white/90 active:scale-[0.99]" : "cursor-not-allowed bg-white/[0.08] text-white/35",
            )}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                Continue <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </motion.form>
      </main>

      <footer className="flex shrink-0 items-center justify-between px-5 py-4 text-[11px] text-white/30">
        <span className="flex items-center gap-3">
          Internal workspace
          <button type="button" onClick={() => setClearView(!clearView)} aria-pressed={clearView} className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors", clearView ? "bg-white text-black" : "text-white/60 hover:text-white")}>
            <Eye className="size-3.5" /> Clear view
          </button>
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn("size-1.5 rounded-full", tape.length ? "bg-[#22c55e]" : "bg-white/30")} />
          {tape.length ? "News feeds live" : "News feeds loading"}
        </span>
      </footer>
    </div>
  );
}
