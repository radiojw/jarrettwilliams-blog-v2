(() => {
  const root = document.querySelector("[data-search]")
  const grid = document.querySelector("[data-search-grid]")
  if (!root || !grid) return
  const input = root.querySelector("[data-search-input]")
  const empty = root.querySelector("[data-search-empty]")
  if (!input) return
  const cards = Array.prototype.slice.call(grid.querySelectorAll("[data-search-text]"))

  const apply = () => {
    const query = input.value.trim().toLowerCase()
    let visible = 0
    cards.forEach((card) => {
      const match = !query || (card.getAttribute("data-search-text") || "").indexOf(query) !== -1
      card.hidden = !match
      if (match) visible += 1
    })
    if (empty) empty.hidden = visible !== 0
  }

  input.addEventListener("input", apply)

  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return
    const active = document.activeElement
    const typing = active && /^(input|textarea|select)$/i.test(active.tagName || "")
    if (!typing) {
      event.preventDefault()
      input.focus()
    }
  })
})()
