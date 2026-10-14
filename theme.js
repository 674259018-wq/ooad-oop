(function () {
  const storageKey = "digital-library-theme";
  let toggle = document.getElementById("theme-toggle");
  if (!toggle) {
    const header = document.querySelector("header > div");
    if (!header) {
      throw new Error("Header is missing; cannot install theme toggle.");
    }
    toggle = document.createElement("button");
    toggle.id = "theme-toggle";
    toggle.type = "button";
    toggle.className = "whitespace-nowrap rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100";
    header.append(toggle);
  }

  function applyTheme(theme) {
    const isDark = theme === "dark";
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    toggle.setAttribute("aria-pressed", String(isDark));
    toggle.setAttribute("aria-label", isDark ? "เปลี่ยนเป็นโหมดกลางวัน" : "เปลี่ยนเป็นโหมดกลางคืน");
    toggle.textContent = isDark ? "☀" : "☾";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#09090b" : "#ffffff");
  }

  let savedTheme = localStorage.getItem(storageKey);
  if (savedTheme !== null && savedTheme !== "light" && savedTheme !== "dark") {
    throw new Error("Saved color theme is invalid.");
  }
  if (savedTheme === null) {
    savedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  applyTheme(savedTheme);

  toggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem(storageKey, nextTheme);
    applyTheme(nextTheme);
  });
})();
