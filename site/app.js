const themeToggle = document.querySelector("[data-theme-toggle]");
const root = document.documentElement;
const storageKey = "cartograph-theme";

function applyTheme(theme) {
  root.setAttribute("data-theme", theme);
  window.localStorage.setItem(storageKey, theme);
}

const savedTheme = window.localStorage.getItem(storageKey);

if (savedTheme === "light" || savedTheme === "dark") {
  applyTheme(savedTheme);
}

themeToggle?.addEventListener("click", () => {
  const nextTheme = root.getAttribute("data-theme") === "light" ? "dark" : "light";
  applyTheme(nextTheme);
});

for (const button of document.querySelectorAll("[data-copy-target]")) {
  button.addEventListener("click", async () => {
    const targetId = button.getAttribute("data-copy-target");
    const target = targetId ? document.getElementById(targetId) : null;

    if (!target) {
      return;
    }

    try {
      await navigator.clipboard.writeText(target.textContent || "");
      button.textContent = "Copied";
      button.setAttribute("data-copy-state", "done");

      window.setTimeout(() => {
        button.textContent = "Copy";
        button.removeAttribute("data-copy-state");
      }, 1400);
    } catch {
      button.textContent = "Copy failed";

      window.setTimeout(() => {
        button.textContent = "Copy";
      }, 1400);
    }
  });
}
