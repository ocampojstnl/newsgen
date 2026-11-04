/** What the Send to NewsGen button carries in the link's fragment, which is never sent to a server. */
export type ImportedArticle = { url: string; title: string; paragraphs: string[] };

export function isWebUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** Reads the fragment. Any website can link here, so the result is untrusted and needs the reporter's confirmation. */
export function parseImportHash(hash: string): ImportedArticle | null {
  try {
    const data = JSON.parse(decodeURIComponent(hash.replace(/^#/, ""))) as { u?: unknown; t?: unknown; p?: unknown };
    if (typeof data.u !== "string" || !isWebUrl(data.u) || typeof data.t !== "string" || !Array.isArray(data.p)) return null;
    return { url: data.u, title: data.t.trim().slice(0, 500), paragraphs: data.p.filter((p): p is string => typeof p === "string") };
  } catch {
    return null;
  }
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Websites often add their name to a title, so a match can be one title containing the other. */
export function titlesMatch(a: string, b: string): boolean {
  const first = normalizeTitle(a);
  const second = normalizeTitle(b);
  if (first.length < 15 || second.length < 15) return first === second;
  return first.includes(second) || second.includes(first);
}

// Runs on the article page in the reporter's own browser. It takes the headline and the
// paragraphs of the main text, then opens NewsGen with them.
const COLLECT = `var words=function(t){return t.trim().split(/\\s+/).length};
var text=function(e){return(e.innerText||'').replace(/\\s+/g,' ').trim()};
var list=function(r){return[].slice.call(r.querySelectorAll('p')).filter(function(p){return words(text(p))>=5})};
var root=document.querySelector('article');
if(!root||list(root).length<3){var s=new Map(),m=0;list(document).forEach(function(p){var a=p.parentElement;s.set(a,(s.get(a)||0)+text(p).length)});s.forEach(function(v,k){if(v>m){m=v;root=k}})}
var h=document.querySelector('h1'),o=document.querySelector('meta[property="og:title"]');
var d={u:location.href.split('#')[0],t:h?text(h):(o?o.content:document.title),p:root?list(root).map(text):[]};`;

export function bookmarkletCode(origin: string): string {
  const open = `window.open(${JSON.stringify(`${origin}/import#`)}+encodeURIComponent(JSON.stringify(d)),'_blank');`;
  return `javascript:(function(){${COLLECT.replace(/\n/g, "")}${open}})();`;
}
