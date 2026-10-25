(() => {
  const storageKey = "theme"
  const root = document.documentElement
  const colors = { light: "#f4f1e8", dark: "#1b1814" }

  const readStoredTheme = () => {
    try {
      const value = localStorage.getItem(storageKey)
      return value === "light" || value === "dark" ? value : ""
    } catch {
      return ""
    }
  }

  const resolvedTheme = () => (root.dataset.theme === "dark" ? "dark" : "light")

  const applyTheme = (theme) => {
    if (theme === "dark") root.dataset.theme = "dark"
    else if (theme === "light") root.dataset.theme = "light"
    else delete root.dataset.theme

    const active = resolvedTheme()
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute("content", colors[active])
  }

  const syncControl = () => {
    const button = document.querySelector("[data-theme-toggle]")
    if (!button) return
    const dark = resolvedTheme() === "dark"
    button.setAttribute("aria-pressed", String(dark))
    const icon = button.querySelector("[data-theme-icon]")
    if (icon) icon.textContent = dark ? "Light" : "Dark"
    const label = button.querySelector(".visually-hidden")
    if (label) label.textContent = dark ? "Use light theme" : "Use dark theme"
  }

  applyTheme(readStoredTheme())

  document.addEventListener("DOMContentLoaded", () => {
    syncControl()
    const button = document.querySelector("[data-theme-toggle]")
    if (!button) return
    button.addEventListener("click", () => {
      const next = resolvedTheme() === "dark" ? "light" : "dark"
      try {
        localStorage.setItem(storageKey, next)
      } catch {
        /* storage can be blocked; the toggle still applies for this view */
      }
      applyTheme(next)
      syncControl()
    })
  })

  window.addEventListener("storage", (event) => {
    if (event.key !== storageKey) return
    const next = event.newValue === "light" || event.newValue === "dark" ? event.newValue : ""
    applyTheme(next)
    syncControl()
  })
})()
