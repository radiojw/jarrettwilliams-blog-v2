import { allTags, getPosts, isoDate } from "../lib/posts"
import { site } from "../lib/site"

export async function GET() {
  const posts = await getPosts()
  const tags = allTags(posts)
  const now = new Date().toISOString()
  const urls = [
    { path: "/", lastmod: now },
    { path: "/blog/", lastmod: now },
    { path: "/about/", lastmod: now },
    ...posts.map((post) => ({ path: `/blog/${post.data.slug}/`, lastmod: isoDate(post.data.date) })),
    ...tags.map((tag) => ({ path: `/tags/${tag.slug}/`, lastmod: now })),
  ]

  const body = urls
    .map((entry) => `<url><loc>${site.url}${entry.path}</loc><lastmod>${entry.lastmod}</lastmod></url>`)
    .join("")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>\n`

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  })
}
