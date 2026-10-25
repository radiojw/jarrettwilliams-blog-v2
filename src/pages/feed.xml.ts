import { escapeXml, getPosts, isoDate } from "../lib/posts"
import { site } from "../lib/site"

export async function GET() {
  const posts = await getPosts()
  const updated = posts[0] ? isoDate(posts[0].data.date) : "1970-01-01T00:00:00.000Z"
  const entries = posts
    .map(
      (post) => `  <entry>
    <title>${escapeXml(post.data.title)}</title>
    <link href="${site.url}/blog/${post.data.slug}/" />
    <id>${site.url}/blog/${post.data.slug}/</id>
    <updated>${isoDate(post.data.date)}</updated>
    <summary>${escapeXml(post.data.description)}</summary>
  </entry>`,
    )
    .join("\n")

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(site.title)}</title>
  <subtitle>${escapeXml(site.description)}</subtitle>
  <link href="${site.url}/feed.xml" rel="self" />
  <link href="${site.url}/" />
  <id>${site.url}/</id>
  <updated>${updated}</updated>
${entries}
</feed>
`

  return new Response(xml, {
    headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
  })
}
