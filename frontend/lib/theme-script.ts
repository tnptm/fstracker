// Shared by the server layout (inline <head> script) and the client theme hook.
export const THEME_STORAGE_KEY = "theme";

// Applies the saved theme before first paint (no light/dark flash).
// Keep the logic in sync with apply() in lib/theme.ts.
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`;
