import fs from "node:fs"
import path from "node:path"
import { createSocialCardPng } from "./make-social-card.mjs"

function readFrontmatterValue(raw, key) {
  const match = raw.match(new RegExp(`^${key}:\\s*"?(.*?)"?\\s*$`, "m"))
  return match?.[1]?.trim() || ""
}

export function generateSocialCards(rootDir = process.cwd()) {
  const contentDir = path.join(rootDir, "content", "posts")
  const outDir = path.join(rootDir, "public", "assets", "images")
  fs.mkdirSync(outDir, { recursive: true })

  for (const name of fs.readdirSync(outDir)) {
    if (name.startsWith("social-card-") && name.endsWith(".png")) {
      fs.unlinkSync(path.join(outDir, name))
    }
  }

  const manifest = {}

  if (fs.existsSync(contentDir)) {
    for (const filename of fs.readdirSync(contentDir).filter((name) => name.endsWith(".md"))) {
      const raw = fs.readFileSync(path.join(contentDir, filename), "utf8")
      const title = readFrontmatterValue(raw, "title")
      const slug = readFrontmatterValue(raw, "slug")
      if (!title || !slug) continue

      const png = createSocialCardPng({ title })
      const imageName = `social-card-${slug}.png`
      fs.writeFileSync(path.join(outDir, imageName), png)
      manifest[slug] = `/assets/images/${imageName}`
    }
  }

  fs.writeFileSync(path.join(outDir, "social-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}
