// Shared by the server layout and the browser hook, so it has no "use client" directive.
export const CLEAR_VIEW_KEY = "newsgen-clear-view";
export const CLEAR_VIEW_CLASS = "clear-view";

/** Runs in <head> before the first paint, so the page never flashes at the normal size. */
export const CLEAR_VIEW_SCRIPT = `try{if(localStorage.getItem("${CLEAR_VIEW_KEY}")==="1")document.documentElement.classList.add("${CLEAR_VIEW_CLASS}")}catch(e){}`;
