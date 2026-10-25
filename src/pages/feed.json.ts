import { getPosts, isoDate, parseTags, socialImageFor } from "../lib/posts"
import { absolute } from "../lib/seo"
import { site } from "../lib/site"

export async function GET() {
  const posts = await getPosts()
  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: site.title,
    home_page_url: `${site.url}/`,
    feed_url: `${site.url}/feed.json`,
    description: site.description,
    language: "en-US",
    authors: [{ name: site.author, url: `${site.url}/` }],
    items: posts.map((post) => ({
      id: `${site.url}/blog/${post.data.slug}/`,
      url: `${site.url}/blog/${post.data.slug}/`,
      title: post.data.title,
      content_html: post.rendered?.html ?? "",
      summary: post.data.description,
      date_published: isoDate(post.data.date),
      tags: parseTags(post.data.tags).map((tag) => tag.label),
      image: absolute(socialImageFor(post.data.slug)),
    })),
  }

  return new Response(`${JSON.stringify(feed, null, 2)}\n`, {
    headers: { "Content-Type": "application/feed+json; charset=utf-8" },
  })
}
