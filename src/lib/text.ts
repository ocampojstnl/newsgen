const NAMED: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  ntilde: "ñ",
  Ntilde: "Ñ",
  peso: "₱",
};

/**
 * Turns HTML codes such as "&nbsp;" and "&#8217;" into the characters they stand for.
 * Repeats because some feeds encode twice ("&amp;nbsp;").
 */
export function decodeEntities(text: string): string {
  let current = text;
  for (let pass = 0; pass < 3; pass++) {
    const next = current.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
      if (code[0] === "#") {
        const value = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
        return Number.isFinite(value) && value > 0 && value < 0x110000 ? String.fromCodePoint(value) : match;
      }
      return NAMED[code] ?? match;
    });
    if (next === current) break;
    current = next;
  }
  return current;
}

/** Decodes HTML codes and tidies spacing, for titles and paragraphs from the web. */
export function cleanText(text: string): string {
  return decodeEntities(text).replace(/ /g, " ").replace(/\s+/g, " ").trim();
}
