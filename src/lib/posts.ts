import fs from "node:fs"
import path from "node:path"
import { getCollection, type CollectionEntry } from "astro:content"
import { site } from "./site"

export type Post = CollectionEntry<"posts">

export interface Tag {
  label: string
  slug: string
}

export interface TagGroup extends Tag {
  count: number
  posts: Post[]
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

export function parseTags(value: string): Tag[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((label) => ({ label, slug: slugify(label) }))
    .filter((tag) => tag.slug)
}

export function formatDate(value: string) {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(normalized))
}

export function isoDate(value: string) {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value
  return new Date(normalized).toISOString()
}

export function readingMinutes(body: string | undefined) {
  const words = (body || "").replace(/```[\s\S]*?```/g, " ").split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 220))
}

export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

let socialManifest: Record<string, string> | null = null

export function socialImageFor(slug: string) {
  if (!socialManifest) {
    const file = path.join(process.cwd(), "public", "assets", "images", "social-manifest.json")
    socialManifest = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, string>) : {}
  }
  return socialManifest[slug] || site.socialImagePath
}

export async function getPosts() {
  const posts = await getCollection("posts")
  posts.sort((a, b) => b.data.date.localeCompare(a.data.date) || a.data.slug.localeCompare(b.data.slug))

  const seen = new Set<string>()
  for (const post of posts) {
    if (seen.has(post.data.slug)) {
      throw new Error(`Duplicate post slug: ${post.data.slug}`)
    }
    seen.add(post.data.slug)
  }

  return posts
}

export function allTags(posts: Post[]): TagGroup[] {
  const map = new Map<string, TagGroup>()
  for (const post of posts) {
    for (const tag of parseTags(post.data.tags)) {
      const entry = map.get(tag.slug) || { ...tag, count: 0, posts: [] }
      entry.count += 1
      entry.posts.push(post)
      map.set(tag.slug, entry)
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export function relatedPosts(post: Post, posts: Post[]) {
  const tagSlugs = new Set(parseTags(post.data.tags).map((tag) => tag.slug))
  return posts
    .filter((candidate) => candidate.data.slug !== post.data.slug)
    .map((candidate) => ({
      post: candidate,
      shared: parseTags(candidate.data.tags).filter((tag) => tagSlugs.has(tag.slug)).length,
    }))
    .filter((candidate) => candidate.shared > 0)
    .sort(
      (a, b) =>
        b.shared - a.shared ||
        b.post.data.date.localeCompare(a.post.data.date) ||
        a.post.data.slug.localeCompare(b.post.data.slug),
    )
    .slice(0, 3)
    .map((candidate) => candidate.post)
}
