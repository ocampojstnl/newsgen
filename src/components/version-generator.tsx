"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Check, ChevronDown, Lightbulb, Loader2, MessageSquareText, Mic, Newspaper, Ruler, Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LANGUAGES, MAX_VERSIONS, PRESETS, readingMinutes, TONES, type LanguageId, type ToneId } from "@/lib/options";
import type { Conflict, Fact, GenerationEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONE_ICONS: Record<ToneId, React.ElementType> = {
  "straight-news": Newspaper,
  explainer: Lightbulb,
  broadcast: Mic,
  plain: MessageSquareText,
};

const TONE_HINTS: Record<ToneId, string> = {
  "straight-news": "Most important facts first, formal.",
  explainer: "Walks the reader through the story.",
  broadcast: "Short lines for reading on air.",
  plain: "Simple words, short sentences.",
};

type Job = { label: string; targetWords: number | null };

async function runJob(storyId: string, job: Job, tone: ToneId, language: LanguageId, onProgress: (message: string) => void) {
  const response = await fetch(`/api/stories/${storyId}/versions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...job, tone, language }),
  });
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "The version could not be generated.");
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let finished: Extract<GenerationEvent, { type: "done" }> | null = null;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines.filter(Boolean)) {
      const event = JSON.parse(line) as GenerationEvent;
      if (event.type === "progress") onProgress(event.message);
      if (event.type === "error") throw new Error(event.message);
      if (event.type === "done") finished = event;
    }
  }
  if (!finished) throw new Error("The connection ended before the version was finished.");
  return finished;
}

export function VersionGenerator({
  storyId,
  defaultOpen,
  sourceLanguage,
  disabledReason,
  remaining,
  onCreated,
}: {
  storyId: string;
  defaultOpen: boolean;
  sourceLanguage: LanguageId;
  disabledReason: string | null;
  remaining: number;
  onCreated: (version: GenerationVersion, facts: Fact[], conflicts: Conflict[]) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [chosen, setChosen] = useState<Set<string>>(new Set(["natural"]));
  const [customWords, setCustomWords] = useState("");
  const [tone, setTone] = useState<ToneId>("straight-news");
  const [language, setLanguage] = useState<LanguageId>(sourceLanguage);
  const [status, setStatus] = useState<string | null>(null);

  const custom = Number(customWords);
  const customValid = customWords !== "" && Number.isInteger(custom) && custom >= 50 && custom <= 3000;
  const jobs: Job[] = [
    ...PRESETS.filter((p) => chosen.has(p.id)).map((p) => ({ label: p.label, targetWords: p.words })),
    ...(customValid ? [{ label: `${custom.toLocaleString("en-PH")} words`, targetWords: custom }] : []),
  ];
  const overLimit = jobs.length > remaining;
  const busy = status !== null;

  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const generate = async () => {
    const toneLabel = TONES[tone].label;
    for (const [index, job] of jobs.entries()) {
      const prefix = jobs.length > 1 ? `Version ${index + 1} of ${jobs.length}: ` : "";
      setStatus(`${prefix}Starting`);
      try {
        const result = await runJob(
          storyId,
          { ...job, label: `${job.label}, ${toneLabel}${language === "English" ? "" : `, ${language}`}` },
          tone,
          language,
          (message) => setStatus(`${prefix}${message}`),
        );
        onCreated(result.version, result.facts, result.conflicts);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "The version could not be generated.");
        break;
      }
    }
    setStatus(null);
    setOpen(false);
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-card/70 shadow-sm backdrop-blur">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/30">
        <span className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-md shadow-primary/30">
            <Sparkles className="size-4" />
          </span>
          <span>
            <span className="block font-semibold tracking-tight">Create versions</span>
            <span className="block text-xs text-muted-foreground">
              {remaining > 0 ? "Written from verified facts, then checked independently." : "All 5 made. Delete one to make another."}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-3">
          <span className="hidden items-center gap-1 sm:flex" aria-label={`${MAX_VERSIONS - remaining} of ${MAX_VERSIONS} versions used`}>
            {Array.from({ length: MAX_VERSIONS }, (_, index) => (
              <span key={index} className={cn("h-1.5 w-4 rounded-full", index < MAX_VERSIONS - remaining ? "bg-primary" : "bg-muted")} />
            ))}
            <span className="tabular ml-1.5 text-xs text-muted-foreground">{remaining} left</span>
          </span>
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="size-4 text-muted-foreground" />
          </motion.span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            <div className="space-y-6 border-t px-5 py-5">
              <Step number={1} title="Length" hint="Pick one or more. Each becomes its own version.">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {PRESETS.map((preset) => {
                    const on = chosen.has(preset.id);
                    const natural = preset.words === null;
                    return (
                      <motion.button
                        key={preset.id}
                        type="button"
                        aria-pressed={on}
                        disabled={busy}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggle(preset.id)}
                        className={cn(
                          "relative flex min-h-[4.5rem] flex-col justify-center rounded-lg border p-3 pr-9 text-left transition-colors disabled:opacity-60",
                          natural && "sm:col-span-2",
                          on ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "bg-background/40 hover:border-primary/40 hover:bg-muted/40",
                        )}
                      >
                        <span className={cn("absolute top-3 right-3 grid size-5 place-items-center rounded-full border transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30")}>
                          {on && <Check className="size-3" />}
                        </span>
                        {natural && (
                          <span className="mb-1.5 inline-flex w-fit items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary uppercase">
                            <Wand2 className="size-3" /> Recommended
                          </span>
                        )}
                        <span className={cn("font-semibold tracking-tight", natural ? "text-base" : "text-sm")}>{preset.label}</span>
                        <span className="mt-0.5 text-xs text-muted-foreground">
                          {natural ? "No word limit. As long as a typical news story needs to cover every fact." : `${preset.words!.toLocaleString("en-PH")} words · ${readingMinutes(preset.words!)}`}
                        </span>
                      </motion.button>
                    );
                  })}
                  <label
                    className={cn(
                      "flex min-h-[4.5rem] flex-col justify-center gap-1.5 rounded-lg border p-3 transition-colors",
                      customValid ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-dashed bg-background/40",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
                      <Ruler className="size-3.5 text-muted-foreground" /> Custom
                    </span>
                    <span className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={50}
                        max={3000}
                        inputMode="numeric"
                        placeholder="e.g. 750"
                        aria-label="Custom word count"
                        className="h-8"
                        value={customWords}
                        disabled={busy}
                        onChange={(event) => setCustomWords(event.target.value)}
                      />
                      <span className="text-xs text-muted-foreground">words</span>
                    </span>
                  </label>
                </div>
              </Step>

              <Step number={2} title="Style" hint="How the story reads.">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="Style">
                  {(Object.keys(TONES) as ToneId[]).map((id) => {
                    const Icon = TONE_ICONS[id];
                    const on = tone === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={busy}
                        onClick={() => setTone(id)}
                        className={cn(
                          "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors disabled:opacity-60",
                          on ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "bg-background/40 hover:border-primary/40 hover:bg-muted/40",
                        )}
                      >
                        <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold tracking-tight">{TONES[id].label}</span>
                          <span className="block text-xs leading-snug text-muted-foreground">{TONE_HINTS[id]}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Step>

              <Step number={3} title="Language" hint={language === sourceLanguage ? "Matches the source article." : `The source article is in ${sourceLanguage}.`}>
                <div className="flex w-fit gap-1 rounded-lg bg-muted/60 p-1" role="radiogroup" aria-label="Language">
                  <LayoutGroup id="language-pick">
                    {(Object.keys(LANGUAGES) as LanguageId[]).map((id) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={language === id}
                        disabled={busy}
                        onClick={() => setLanguage(id)}
                        className={cn("relative flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors", language === id ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
                      >
                        {language === id && <motion.span layoutId="language-pill" className="absolute inset-0 rounded-md bg-background shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                        <span className="relative">{LANGUAGES[id].label}</span>
                        {id === sourceLanguage && <span className="relative text-[10px] text-muted-foreground">source</span>}
                      </button>
                    ))}
                  </LayoutGroup>
                </div>
              </Step>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t bg-muted/30 px-5 py-4">
              <div aria-live="polite" className="min-w-52 flex-1 text-sm">
                {status ? (
                  <div className="space-y-2">
                    <div className="h-1 overflow-hidden rounded-full bg-muted">
                      <div className="progress-bar h-full w-2/5 rounded-full bg-primary" />
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.p key={status} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18 }} className="text-muted-foreground">
                        {status}. This can take a minute or two.
                      </motion.p>
                    </AnimatePresence>
                  </div>
                ) : disabledReason ? (
                  <p className="text-destructive">{disabledReason}</p>
                ) : customWords !== "" && !customValid ? (
                  <p className="text-destructive">Enter a whole number from 50 to 3,000.</p>
                ) : overLimit ? (
                  <p className="text-destructive">You have room for {remaining} more on this story.</p>
                ) : jobs.length === 0 ? (
                  <p className="text-muted-foreground">Choose at least one length.</p>
                ) : (
                  <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                    {jobs.map((job) => (
                      <span key={job.label} className="rounded-md border bg-background/60 px-2 py-0.5 text-xs font-medium text-foreground">
                        {job.label}
                      </span>
                    ))}
                    <span className="text-xs">
                      · {TONES[tone].label} · {LANGUAGES[language].label}
                    </span>
                  </p>
                )}
              </div>
              <Button size="lg" className="group shadow-lg shadow-primary/25" onClick={generate} disabled={busy || jobs.length === 0 || overLimit || remaining === 0 || disabledReason !== null || (customWords !== "" && !customValid)}>
                {busy ? <Loader2 className="animate-spin" /> : <Sparkles className="transition-transform group-hover:rotate-12" />}
                {busy ? "Writing" : `Generate ${jobs.length > 1 ? `${jobs.length} versions` : "version"}`}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Step({ number, title, hint, children }: { number: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span className="tabular grid size-5 place-items-center self-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">{number}</span>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {children}
    </section>
  );
}

type GenerationVersion = Extract<GenerationEvent, { type: "done" }>["version"];
