import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { ApiError } from "@/lib/api";

const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const FALLBACK_MODELS = (
  process.env.GEMINI_FALLBACK_MODELS ||
  "gemini-3.6-flash,gemini-3.7-flash,gemini-3.5-flash,gemini-flash-lite-latest,gemini-3.5-flash-lite"
)
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const REQUEST_TIMEOUT_MS = 120_000;

// Demand moves between Gemini models, so retries rotate through them and wait longer each round.
const ROUND_WAITS_MS = [0, 3_000, 10_000];
const ATTEMPTS = ROUND_WAITS_MS.flatMap((waitMs) =>
  [PRIMARY_MODEL, ...FALLBACK_MODELS].map((model, index) => ({ model, waitMs: index === 0 ? waitMs : 0 })),
);

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new ApiError(500, "GEMINI_API_KEY is not set.");
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

function statusOf(error: unknown): number | undefined {
  return (error as { status?: number })?.status;
}

export async function generateJson<T extends z.ZodType>(options: {
  system: string;
  prompt: string;
  schema: T;
}): Promise<z.infer<T>> {
  const jsonSchema = z.toJSONSchema(options.schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  let lastError: unknown;
  // A model at its quota will not recover within this request, so it is not asked again.
  const overQuota = new Set<string>();

  for (const { model, waitMs } of ATTEMPTS) {
    if (overQuota.has(model)) continue;
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    try {
      const response = await getClient().models.generateContent({
        model,
        contents: options.prompt,
        config: {
          systemInstruction: options.system,
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
          httpOptions: { timeout: REQUEST_TIMEOUT_MS },
        },
      });
      if (!response.text) {
        throw new Error(`Gemini returned no text (${response.candidates?.[0]?.finishReason ?? "unknown reason"}).`);
      }
      return options.schema.parse(JSON.parse(response.text));
    } catch (error) {
      lastError = error;
      const status = statusOf(error);
      console.warn(`Gemini attempt failed on ${model}: ${status ?? (error instanceof Error ? error.message.slice(0, 200) : "unknown")}`);
      if (status === 401 || status === 403) break;
      if (status === 429) overQuota.add(model);
    }
  }

  console.error(lastError);
  const status = statusOf(lastError);
  if (status === 401 || status === 403 || status === 400) {
    throw new ApiError(502, "Gemini rejected the request. Check the API key and model name in .env.local.");
  }
  if (status === 429) {
    throw new ApiError(429, "This Gemini API key has reached its usage limit. Nothing was saved. Wait a few minutes, or check the key's plan in Google AI Studio.");
  }
  if (status !== undefined && status >= 500) {
    throw new ApiError(503, "Gemini is busy right now. Nothing was saved. Please try again in a minute.");
  }
  throw new ApiError(502, "Gemini did not return a usable result. Nothing was saved. Please try again.");
}
