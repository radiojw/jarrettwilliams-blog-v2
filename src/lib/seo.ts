import { isoDate, socialImageFor, type Post } from "./posts"
import { site } from "./site"

export function absolute(pathname: string) {
  return new URL(pathname, site.url).href
}

function person() {
  return {
    "@type": "Person",
    name: site.author,
    url: `${site.url}/`,
    sameAs: [site.linkedin],
  }
}

export function homeJsonLd() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: site.title,
      url: `${site.url}/`,
      description: site.description,
      author: person(),
    },
    {
      "@context": "https://schema.org",
      "@type": "Person",
      name: site.author,
      url: `${site.url}/`,
      sameAs: [site.linkedin],
      jobTitle: "Staff Systems Engineer",
      knowsAbout: [
        "IT Operations",
        "Systems Engineering",
        "Azure",
        "Automation",
        "Networking",
        "Datacenter Operations",
      ],
    },
  ]
}

export function blogJsonLd(posts: Post[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: `${site.title} Notes`,
    url: `${site.url}/blog/`,
    description: site.description,
    publisher: { "@type": "Person", name: site.author },
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.data.title,
      url: `${site.url}/blog/${post.data.slug}/`,
      datePublished: isoDate(post.data.date),
      author: { "@type": "Person", name: site.author },
    })),
  }
}

export function postJsonLd(post: Post) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.data.title,
    description: post.data.description,
    datePublished: isoDate(post.data.date),
    dateModified: isoDate(post.data.date),
    author: person(),
    publisher: person(),
    mainEntityOfPage: `${site.url}/blog/${post.data.slug}/`,
    image: [absolute(socialImageFor(post.data.slug))],
  }
}

export function pageJsonLd(name: string, pathname: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name,
    url: absolute(pathname),
    description,
  }
}
