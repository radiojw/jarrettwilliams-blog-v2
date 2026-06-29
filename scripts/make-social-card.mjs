// Regenerates the Open Graph / Twitter share card as a 1200x630 PNG.
//
// Why a generator (not part of `npm run build`): rasterizing SVG->PNG needs a
// renderer (@resvg/resvg-js) that we deliberately keep OUT of the project's
// dependencies — the site ships zero runtime/build deps. Run this only when the
// card design changes:
//
//   npm install --no-save @resvg/resvg-js
//   node scripts/make-social-card.mjs
//
// The committed output (src/images/social-card.png) is what the build copies to
// /assets/images/social-card.png. Most social platforms refuse to render an SVG
// og:image, which is why this exists.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const fontsDir = path.join(rootDir, "src", "fonts")
const outPath = path.join(rootDir, "src", "images", "social-card.png")

const title = "Jarrett Williams"
const tagline = "IT operations, systems engineering, and practical notes"
const sub = "Field notes on infrastructure, identity, and automation"

function esc(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// Palette mirrors src/styles.css :root (keep in sync if the theme changes).
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a0b10"/>
      <stop offset="1" stop-color="#12141d"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.18" cy="0.0" r="0.9">
      <stop offset="0" stop-color="#6ea8ff" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#6ea8ff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="0" y="0" width="1200" height="8" fill="#ffb454"/>
  <text x="90" y="150" fill="#ffb454" font-family="Inter" font-size="26" font-weight="600" letter-spacing="3">JARRETTWILLIAMS.COM</text>
  <text x="88" y="290" fill="#f3f5fa" font-family="Source Serif 4" font-size="92" font-weight="700">${esc(title)}</text>
  <text x="90" y="360" fill="#c3c9d6" font-family="Inter" font-size="34" font-weight="500">${esc(sub)}</text>
  <rect x="90" y="470" width="64" height="4" rx="2" fill="#6ea8ff"/>
  <text x="90" y="528" fill="#7b8394" font-family="Inter" font-size="26" font-weight="500">${esc(tagline)}</text>
</svg>`

const { Resvg } = await import("@resvg/resvg-js")

const fontFiles = fs
  .readdirSync(fontsDir)
  .filter((f) => /\.(woff2?|ttf|otf)$/i.test(f))
  .map((f) => path.join(fontsDir, f))

const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1200 },
  font: { fontFiles, loadSystemFonts: true },
})
const png = resvg.render().asPng()
fs.writeFileSync(outPath, png)
console.log(`Wrote ${outPath} (${(png.length / 1024).toFixed(1)} KB)`)
