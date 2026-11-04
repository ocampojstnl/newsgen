// News outlets must not be named in article copy. They are credited in the source list instead.
const OUTLET_PATTERNS: [RegExp, string][] = [
  [/\bGMA(?: News| Network| Integrated News)?\b/g, "GMA"],
  [/\bABS-?CBN(?: News)?\b/gi, "ABS-CBN"],
  [/\bTV ?Patrol\b/gi, "TV Patrol"],
  [/\bTV5\b|\bNews ?5\b/g, "TV5"],
  [/\bBombo Radyo\b/gi, "Bombo Radyo"],
  [/\bInquirer(?:\.net)?\b/g, "Inquirer"],
  [/\bPhilstar(?:\.com)?\b|\bPhilippine Star\b/gi, "Philstar"],
  [/\bRappler\b/gi, "Rappler"],
  [/\bManila Times\b/gi, "Manila Times"],
  [/\bManila Bulletin\b/gi, "Manila Bulletin"],
  [/\bBusinessWorld\b/gi, "BusinessWorld"],
  [/\bSunStar\b/gi, "SunStar"],
  [/\bSuperBalita\b/gi, "SuperBalita"],
  [/\bPunto!/g, "Punto!"],
  [/\bCLTV ?(?:36)?\b/g, "CLTV36"],
  [/\bPampanga News Now\b/gi, "Pampanga News Now"],
  [/\bPhilippine News Agency\b|\bPNA\b/g, "PNA"],
  [/\bInteraksyon\b/gi, "Interaksyon"],
  [/\bReuters\b/g, "Reuters"],
  [/\bAgence France-Presse\b|\bAFP\b/g, "AFP"],
  [/\bAssociated Press\b/g, "Associated Press"],
];

/** Names in copy, ignoring direct quotations, which must stay word for word. */
export function findOutletNames(text: string): string[] {
  const outsideQuotes = text.replace(/["“][^"“”]*["”]/g, " ");
  return OUTLET_PATTERNS.filter(([pattern]) => outsideQuotes.search(pattern) >= 0).map(([, name]) => name);
}
