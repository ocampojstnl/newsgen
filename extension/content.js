// Runs only on NewsGen pages. It connects the app to the background worker.
document.documentElement.dataset.newsgenExtension = "1";

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  const message = event.data;
  if (message?.source !== "newsgen-page" || message.type !== "grab") return;

  chrome.runtime.sendMessage({ type: "grab", url: message.url }, (result) => {
    const failed = chrome.runtime.lastError ? { error: "The extension could not be reached. Reload this page and try again." } : result;
    window.postMessage({ source: "newsgen-extension", id: message.id, result: failed }, window.location.origin);
  });
});
