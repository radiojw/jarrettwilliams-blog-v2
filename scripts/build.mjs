import fs from "node:fs"
import path from "node:path"

const rootDir = process.cwd()
const contentDir = path.join(rootDir, "content", "posts")
const distDir = path.join(rootDir, "dist")
const assetsDir = path.join(distDir, "assets")
const stylesPath = path.join(rootDir, "src", "styles.css")
const consentScriptPath = path.join(assetsDir, "consent.js")

const site = {
  title: "Jarrett Williams",
  description:
    "Practical notes on IT operations, networking, endpoint management, and datacenter work.",
  url: "https://jarrettwilliams.com",
  author: "Jarrett Williams",
  linkedin: "https://www.linkedin.com/in/jarrettwilliams/",
}

const consentStorageKey = "jarrett_cookie_choice"

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function cleanDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true })
  }
  ensureDir(dirPath)
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

function renderInlineMarkdown(value) {
  const codeSnippets = []

  let rendered = escapeHtml(value).replace(/`([^`]+)`/g, (_match, code) => {
    const placeholder = `__CODE_${codeSnippets.length}__`
    codeSnippets.push(`<code>${escapeHtml(code)}</code>`)
    return placeholder
  })

  rendered = rendered
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")

  codeSnippets.forEach((snippet, index) => {
    rendered = rendered.replace(`__CODE_${index}__`, snippet)
  })

  return rendered
}

function renderMarkdown(content) {
  const lines = content.replace(/\r\n/g, "\n").split("\n")
  const html = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    if (trimmed.startsWith("```")) {
      const codeLines = []
      index += 1

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index])
        index += 1
      }

      if (index < lines.length) {
        index += 1
      }

      html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`)
      continue
    }

    if (trimmed.startsWith("<")) {
      const rawHtml = []

      while (index < lines.length && lines[index].trim()) {
        rawHtml.push(lines[index])
        index += 1
      }

      html.push(rawHtml.join("\n"))
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      html.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`)
      index += 1
      continue
    }

    const unorderedListMatch = trimmed.match(/^[-*]\s+(.*)$/)
    if (unorderedListMatch) {
      const items = []

      while (index < lines.length) {
        const currentMatch = lines[index].trim().match(/^[-*]\s+(.*)$/)
        if (!currentMatch) {
          break
        }
        items.push(`<li>${renderInlineMarkdown(currentMatch[1])}</li>`)
        index += 1
      }

      html.push(`<ul>${items.join("")}</ul>`)
      continue
    }

    const orderedListMatch = trimmed.match(/^\d+\.\s+(.*)$/)
    if (orderedListMatch) {
      const items = []

      while (index < lines.length) {
        const currentMatch = lines[index].trim().match(/^\d+\.\s+(.*)$/)
        if (!currentMatch) {
          break
        }
        items.push(`<li>${renderInlineMarkdown(currentMatch[1])}</li>`)
        index += 1
      }

      html.push(`<ol>${items.join("")}</ol>`)
      continue
    }

    const paragraphLines = []

    while (index < lines.length) {
      const currentLine = lines[index]
      const currentTrimmed = currentLine.trim()
      if (
        !currentTrimmed ||
        currentTrimmed.startsWith("```") ||
        currentTrimmed.startsWith("<") ||
        /^#{1,6}\s+/.test(currentTrimmed) ||
        /^[-*]\s+/.test(currentTrimmed) ||
        /^\d+\.\s+/.test(currentTrimmed)
      ) {
        break
      }

      paragraphLines.push(currentTrimmed)
      index += 1
    }

    html.push(`<p>${renderInlineMarkdown(paragraphLines.join(" "))}</p>`)
  }

  return html.join("\n")
}

function parseFrontmatter(fileContents) {
  const normalized = fileContents.replace(/\r\n/g, "\n")

  if (!normalized.startsWith("---\n")) {
    return { metadata: {}, body: normalized.trim() }
  }

  const closingDelimiterIndex = normalized.indexOf("\n---\n", 4)
  if (closingDelimiterIndex === -1) {
    return { metadata: {}, body: normalized.trim() }
  }

  const rawMetadata = normalized.slice(4, closingDelimiterIndex)
  const body = normalized.slice(closingDelimiterIndex + 5).trim()
  const metadata = {}

  for (const line of rawMetadata.split("\n")) {
    const separatorIndex = line.indexOf(":")
    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const rawValue = line.slice(separatorIndex + 1).trim()
    metadata[key] = rawValue.replace(/^"(.*)"$/, "$1")
  }

  return { metadata, body }
}

function formatDate(value) {
  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(normalizedValue))
}

function readPosts() {
  if (!fs.existsSync(contentDir)) {
    return []
  }

  return fs
    .readdirSync(contentDir)
    .filter((filename) => filename.endsWith(".md"))
    .map((filename) => {
      const fullPath = path.join(contentDir, filename)
      const contents = fs.readFileSync(fullPath, "utf8")
      const { metadata, body } = parseFrontmatter(contents)
      const basename = path.basename(filename, ".md")
      const fallbackSlug = slugify(basename.replace(/^\d{4}-\d{2}-\d{2}-/, ""))
      const slug = metadata.slug ? slugify(metadata.slug) : fallbackSlug

      return {
        title: metadata.title || basename,
        date: metadata.date || "1970-01-01",
        description: metadata.description || "",
        slug,
        body,
        html: renderMarkdown(body),
      }
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

function pageTemplate({ title, description, content, canonicalPath }) {
  const canonicalUrl = canonicalPath ? `${site.url}${canonicalPath}` : site.url
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="stylesheet" href="/assets/styles.css" />
    <script src="/assets/consent.js" defer></script>
  </head>
  <body>
    <div class="site-shell">
      <header class="site-header">
        <div class="brand-block">
          <a class="brand" href="/">Jarrett Williams</a>
          <p class="tagline">IT operations, infrastructure, and field notes</p>
        </div>
        <nav class="nav">
          <a href="/">Home</a>
          <a href="/blog/">Blog</a>
          <a href="/about/">About</a>
        </nav>
      </header>
      <main class="site-main">
        ${content}
      </main>
      <footer class="site-footer">
        <p>Copyright 2026 jarrettwilliams.com</p>
        <div class="footer-links">
          <a href="/cookies/">Cookies</a>
          <a href="/privacy/">Privacy</a>
          <a href="${site.linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        </div>
      </footer>
    </div>
    <section class="cookie-banner" data-cookie-banner hidden>
      <div class="cookie-copy">
        <p class="cookie-title">Cookie choices</p>
        <p>This site uses essential site storage and may add optional measurement later. Choose what to allow.</p>
      </div>
      <div class="cookie-actions">
        <a class="button" href="/cookies/">View policy</a>
        <button class="button" type="button" data-cookie-choice="deny">Deny</button>
        <button class="button button-primary" type="button" data-cookie-choice="accept">Accept</button>
      </div>
    </section>
  </body>
</html>`
}

function renderHome(posts) {
  const featuredPosts = posts.slice(0, 3)
  const topics = ["Endpoint Management", "Identity and Access", "Datacenter Work", "Networking", "macOS Admin"]

  const cards = featuredPosts
    .map(
      (post) => `<article class="post-card">
        <time datetime="${post.date}">${formatDate(post.date)}</time>
        <h3><a href="/blog/${post.slug}/">${escapeHtml(post.title)}</a></h3>
        <p>${escapeHtml(post.description)}</p>
      </article>`
    )
    .join("")

  return `<section class="hero-grid">
    <div class="panel panel-copy">
      <p class="eyebrow">Field Notes</p>
      <h1>Practical write-ups for the jobs that land on the infrastructure side of IT.</h1>
      <p class="lede">Real-world notes on endpoint work, identity cleanup, networking, datacenter visits, and the little decisions that keep systems stable.</p>
      <div class="topic-list">${topics.map((topic) => `<span>${topic}</span>`).join("")}</div>
    </div>
    <div class="panel panel-image">
      <img src="https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80" alt="Close-up of computer hardware and lighting in a datacenter-style environment" />
    </div>
  </section>
  <section class="split-grid">
    <div class="panel panel-image">
      <img src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80" alt="Rows of servers with indicator lights in a datacenter" />
    </div>
    <div class="panel panel-copy">
      <p class="eyebrow">About</p>
      <h2>Built for useful answers, not filler.</h2>
      <p>This site is a running notebook for the operational side of IT: the tickets, migrations, cleanups, and field work that rarely fit neatly into vendor docs.</p>
      <p>This rebuild is fully static, which means no runtime API, no client-side post loader, and a much simpler deployment path for the final production domain.</p>
      <div class="button-row">
        <a class="button button-primary" href="/blog/">Read the blog</a>
        <a class="button" href="/about/">More about Jarrett</a>
      </div>
    </div>
  </section>
  <section class="listing-section">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Recent Posts</p>
        <h2>Latest write-ups</h2>
      </div>
      <a href="/blog/">View all posts</a>
    </div>
    <div class="post-grid">${cards}</div>
  </section>`
}

function renderBlogIndex(posts) {
  const cards = posts
    .map(
      (post) => `<article class="post-card">
        <time datetime="${post.date}">${formatDate(post.date)}</time>
        <h3><a href="/blog/${post.slug}/">${escapeHtml(post.title)}</a></h3>
        <p>${escapeHtml(post.description)}</p>
      </article>`
    )
    .join("")

  return `<section class="panel panel-copy">
    <p class="eyebrow">Blog</p>
    <h1>Posts and walkthroughs</h1>
    <p class="lede">Real notes from endpoint work, datacenter visits, identity cleanup, and the systems work that usually has to be figured out in motion.</p>
  </section>
  <section class="listing-section">
    <div class="post-grid">${cards}</div>
  </section>`
}

function renderPost(post) {
  return `<article class="panel post-panel">
    <p class="eyebrow">Blog Post</p>
    <h1>${escapeHtml(post.title)}</h1>
    <p class="lede">${escapeHtml(post.description)}</p>
    <time datetime="${post.date}">${formatDate(post.date)}</time>
    <div class="post-content">${post.html}</div>
  </article>`
}

function renderAbout() {
  return `<section class="split-grid">
    <div class="panel panel-image">
      <img src="https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80" alt="Technician working at a laptop in a server room" />
    </div>
    <div class="panel panel-copy">
      <p class="eyebrow">About</p>
      <h1>A working notebook for infrastructure problems.</h1>
      <p>I use this site to document the practical side of IT work: endpoint administration, identity cleanup, datacenter visits, networking, and the one-off fixes that never seem to make it into official docs.</p>
      <p>The goal is simple: leave behind useful write-ups that save someone else a few hours of trial, error, and tab-hoarding.</p>
      <p>This version keeps the stack intentionally small. Posts live in files, pages are generated statically, and deployment is just static files.</p>
    </div>
  </section>`
}

function renderPrivacy() {
  return `<section class="panel post-panel">
    <p class="eyebrow">Privacy</p>
    <h1>Privacy policy</h1>
    <div class="post-content">
      <p>This site is a simple content site. It is not built around accounts, comments, or user dashboards.</p>
      <p>Basic server logs or analytics may be collected by the hosting platform to keep the site running and understand general traffic patterns.</p>
      <p>No personal information is intentionally sold or shared for advertising purposes through this site.</p>
      <p>If that changes, this page should be updated to reflect it clearly.</p>
    </div>
  </section>`
}

function renderCookies() {
  return `<section class="panel post-panel">
    <p class="eyebrow">Cookies</p>
    <h1>Cookie policy</h1>
    <div class="post-content">
      <p>This site is a static publishing site and keeps its data collection intentionally light.</p>
      <p>The site may use essential browser storage to remember choices such as your cookie preference. That storage helps the site avoid showing the same prompt on every visit.</p>
      <p>No advertising, profiling, or third-party tracking cookies are intentionally loaded by this site today.</p>
      <p>If optional analytics or similar tools are added later, they should only run after an accepted choice and this page should be updated to describe them clearly.</p>
      <p>You can change your choice at any time by clearing site storage in your browser and revisiting the site.</p>
    </div>
  </section>`
}

function writeConsentScript() {
  const script = `(() => {
  const storageKey = ${JSON.stringify(consentStorageKey)};
  const banner = document.querySelector("[data-cookie-banner]");
  if (!banner) return;

  const applyChoice = (choice) => {
    try {
      localStorage.setItem(storageKey, choice);
    } catch {}
    document.documentElement.dataset.cookieChoice = choice;
    banner.hidden = true;
  };

  let existingChoice = "";
  try {
    existingChoice = localStorage.getItem(storageKey) || "";
  } catch {}

  if (existingChoice === "accept" || existingChoice === "deny") {
    document.documentElement.dataset.cookieChoice = existingChoice;
    banner.hidden = true;
    return;
  }

  banner.hidden = false;

  banner.querySelectorAll("[data-cookie-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      applyChoice(button.getAttribute("data-cookie-choice") || "deny");
    });
  });
})();`

  fs.writeFileSync(consentScriptPath, script)
}

function writePage(relativePath, html) {
  const outputPath = path.join(distDir, relativePath)
  ensureDir(path.dirname(outputPath))
  fs.writeFileSync(outputPath, html)
}

function build() {
  const posts = readPosts()
  cleanDir(distDir)
  ensureDir(assetsDir)
  fs.copyFileSync(stylesPath, path.join(assetsDir, "styles.css"))
  writeConsentScript()

  writePage(
    "index.html",
    pageTemplate({
      title: `${site.title} | IT Operations and Infrastructure`,
      description: site.description,
      canonicalPath: "",
      content: renderHome(posts),
    })
  )

  writePage(
    path.join("blog", "index.html"),
    pageTemplate({
      title: `Blog | ${site.title}`,
      description: site.description,
      canonicalPath: "/blog/",
      content: renderBlogIndex(posts),
    })
  )

  for (const post of posts) {
    writePage(
      path.join("blog", post.slug, "index.html"),
      pageTemplate({
        title: `${post.title} | ${site.title}`,
        description: post.description,
        canonicalPath: `/blog/${post.slug}/`,
        content: renderPost(post),
      })
    )
  }

  writePage(
    path.join("about", "index.html"),
    pageTemplate({
      title: `About | ${site.title}`,
      description: site.description,
      canonicalPath: "/about/",
      content: renderAbout(),
    })
  )

  writePage(
    path.join("privacy", "index.html"),
    pageTemplate({
      title: `Privacy | ${site.title}`,
      description: site.description,
      canonicalPath: "/privacy/",
      content: renderPrivacy(),
    })
  )

  writePage(
    path.join("cookies", "index.html"),
    pageTemplate({
      title: `Cookies | ${site.title}`,
      description: "Cookie policy for jarrettwilliams.com",
      canonicalPath: "/cookies/",
      content: renderCookies(),
    })
  )

  fs.writeFileSync(
    path.join(distDir, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`
  )

  const sitemapEntries = [
    "",
    "/blog/",
    "/about/",
    "/cookies/",
    "/privacy/",
    ...posts.map((post) => `/blog/${post.slug}/`),
  ]
    .map((entry) => `<url><loc>${site.url}${entry}</loc></url>`)
    .join("")

  fs.writeFileSync(
    path.join(distDir, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapEntries}</urlset>\n`
  )

  const feedEntries = posts
    .map(
      (post) => `<entry>
  <title>${escapeHtml(post.title)}</title>
  <link href="${site.url}/blog/${post.slug}/" />
  <id>${site.url}/blog/${post.slug}/</id>
  <updated>${post.date}T00:00:00Z</updated>
  <summary>${escapeHtml(post.description)}</summary>
</entry>`
    )
    .join("\n")

  fs.writeFileSync(
    path.join(distDir, "feed.xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeHtml(site.title)}</title>
  <subtitle>${escapeHtml(site.description)}</subtitle>
  <link href="${site.url}/feed.xml" rel="self" />
  <link href="${site.url}/" />
  <id>${site.url}/</id>
  <updated>${posts[0]?.date || "1970-01-01"}T00:00:00Z</updated>
  ${feedEntries}
</feed>
`
  )

  fs.writeFileSync(
    path.join(distDir, "404.html"),
    pageTemplate({
      title: `Not Found | ${site.title}`,
      description: site.description,
      canonicalPath: "",
      content: `<section class="panel post-panel"><p class="eyebrow">404</p><h1>Page not found</h1><p class="lede">The page you were looking for is not here.</p><a class="button button-primary" href="/">Back home</a></section>`,
    })
  )

  console.log(`Built ${posts.length} posts into ${distDir}`)
}

build()
