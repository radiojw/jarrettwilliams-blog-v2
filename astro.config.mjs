import { defineConfig } from "astro/config"
import { unified } from "@astrojs/markdown-remark"
import rehypeRaw from "rehype-raw"
import rehypeSanitize from "rehype-sanitize"
import { generateSocialCards } from "./scripts/generate-social-cards.mjs"
import { rehypeCodeLabel } from "./scripts/rehype-code-label.mjs"
import { sanitizeSchema } from "./src/lib/sanitize-schema.mjs"

function socialCards() {
  return {
    name: "social-cards",
    hooks: {
      "astro:config:setup"() {
        generateSocialCards(process.cwd())
      },
    },
  }
}

export default defineConfig({
  site: "https://jarrettwilliams.com",
  output: "static",
  trailingSlash: "always",
  integrations: [socialCards()],
  build: {
    format: "directory",
    inlineStylesheets: "never",
  },
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
  },
  markdown: {
    syntaxHighlight: "prism",
    processor: unified({
      // Parse authored HTML before sanitation. Astro also runs rehype-raw later,
      // after headings are stamped, so this pass only exists to make the
      // sanitizer see real elements instead of raw nodes.
      rehypePlugins: [rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeCodeLabel],
    }),
  },
})
