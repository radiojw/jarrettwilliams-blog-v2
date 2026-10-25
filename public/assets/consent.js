(() => {
  const storageKey = "jarrett_cookie_choice"
  const banner = document.querySelector("[data-cookie-banner]")
  if (!banner) return

  const applyChoice = (choice) => {
    try {
      localStorage.setItem(storageKey, choice)
    } catch {
      /* the banner still closes for this visit */
    }
    document.documentElement.dataset.cookieChoice = choice
    banner.hidden = true
  }

  let existingChoice = ""
  try {
    existingChoice = localStorage.getItem(storageKey) || ""
  } catch {
    existingChoice = ""
  }

  if (existingChoice === "accept" || existingChoice === "deny") {
    document.documentElement.dataset.cookieChoice = existingChoice
    banner.hidden = true
    return
  }

  banner.hidden = false
  banner.querySelectorAll("[data-cookie-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      applyChoice(button.getAttribute("data-cookie-choice") || "deny")
    })
  })
})()
