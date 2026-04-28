import fs from "node:fs"
import path from "node:path"

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

function quote(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

const title = process.argv.slice(2).join(" ").trim()

if (!title) {
  console.error('Usage: npm run new-post -- "Your Post Title"')
  process.exit(1)
}

const date = new Date().toISOString().slice(0, 10)
const slug = slugify(title)
const postsDir = path.join(process.cwd(), "content", "posts")
const outputPath = path.join(postsDir, `${date}-${slug}.md`)

if (fs.existsSync(outputPath)) {
  console.error(`Post already exists: ${outputPath}`)
  process.exit(1)
}

fs.mkdirSync(postsDir, { recursive: true })

const template = `---
title: ${quote(title)}
date: ${quote(date)}
description: "Add a short description here."
slug: ${quote(slug)}
---

# ${title}

Write your post here.
`

fs.writeFileSync(outputPath, template, "utf8")
console.log(outputPath)
