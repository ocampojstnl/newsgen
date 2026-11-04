// Opens one article per click, in this browser, and reads it the way the reporter would see it.
// It does not solve bot checks. If a site shows one, the tab stays open for the reporter.
const MIN_WORDS = 40;
const WAIT_MS = 40000;
const POLL_MS = 1500;

// Runs inside the article's tab, after readability.js has been loaded there.
function collectArticle() {
  const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
  const parsed = new Readability(document.cloneNode(true), { charThreshold: 200 }).parse();
  const holder = document.createElement("div");
  holder.innerHTML = parsed?.content ?? "";

  const blocks = [...holder.querySelectorAll("p, li, blockquote, h2, h3")].filter((el) => !el.querySelector("p, li, blockquote"));
  let paragraphs = blocks.map((el) => clean(el.textContent)).filter((value) => value.split(" ").length >= 3);
  // Some sites put article text directly in <div> elements instead of paragraphs.
  if (paragraphs.join(" ").split(" ").length < 40) {
    const lines = (holder.innerText || holder.textContent || "").split(/\n+/).map(clean);
    paragraphs = lines.filter((value) => value.split(" ").length >= 3);
  }

  const heading = document.querySelector("h1");
  return {
    url: location.href.split("#")[0],
    title: clean(heading?.textContent) || clean(parsed?.title) || document.title,
    paragraphs,
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readTab(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["readability.js"] });
  const [frame] = await chrome.scripting.executeScript({ target: { tabId }, func: collectArticle });
  return frame?.result ?? null;
}

const countWords = (article) => article.paragraphs.join(" ").split(/\s+/).filter(Boolean).length;

async function grab(url, senderTabId) {
  const { protocol } = new URL(url);
  if (protocol !== "https:" && protocol !== "http:") return { error: "Only web links can be opened." };

  const tab = await chrome.tabs.create({ url, active: true });
  const deadline = Date.now() + WAIT_MS;
  let previousWords = 0;
  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    const article = await readTab(tab.id).catch(() => null);
    const stillRedirecting = !article || new URL(article.url).hostname === "news.google.com";
    const words = stillRedirecting ? 0 : countWords(article);
    // News pages load in stages, so the text must stop growing before it counts as complete.
    const settled = words >= MIN_WORDS && words === previousWords;
    previousWords = words;
    if (settled) {
      await chrome.tabs.remove(tab.id);
      if (senderTabId !== undefined) await chrome.tabs.update(senderTabId, { active: true });
      return { article };
    }
  }
  return { error: "No article text was found. If that tab shows a security check, complete it, then grab the article again." };
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== "grab" || typeof message.url !== "string") return false;
  grab(message.url, sender.tab?.id)
    .then(respond)
    .catch(() => respond({ error: "The article could not be opened." }));
  return true; // The response arrives after the tab has been read.
});
