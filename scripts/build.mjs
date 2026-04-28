import fs from "node:fs"
import path from "node:path"

const rootDir = process.cwd()
const contentDir = path.join(rootDir, "content", "posts")
const distDir = path.join(rootDir, "dist")
const assetsDir = path.join(distDir, "assets")
const stylesPath = path.join(rootDir, "src", "styles.css")
const consentScriptPath = path.join(assetsDir, "consent.js")
const faviconPath = path.join(rootDir, "src", "favicon.svg")
const imagesSrcDir = path.join(rootDir, "src", "images")
const imagesDistDir = path.join(assetsDir, "images")

const site = {
  title: "Jarrett Williams",
  description:
    "Practical notes on IT operations, systems engineering, Azure, automation, networking, and datacenter work.",
  url: "https://jarrettwilliams.com",
  author: "Jarrett Williams",
  locale: "en_US",
  linkedin: "https://www.linkedin.com/in/jarrettwilliams/",
  socialImagePath: "/assets/social-card.svg",
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

function copyDir(sourceDir, destinationDir) {
  if (!fs.existsSync(sourceDir)) {
    return
  }

  ensureDir(destinationDir)

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name)
    const destinationPath = path.join(destinationDir, entry.name)

    if (entry.isDirectory()) {
      copyDir(sourcePath, destinationPath)
    } else {
      fs.copyFileSync(sourcePath, destinationPath)
    }
  }
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function toAbsoluteUrl(urlOrPath) {
  if (/^https?:\/\//.test(urlOrPath)) {
    return urlOrPath
  }

  return `${site.url}${urlOrPath}`
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
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label, url) => {
      const rel = /^https?:\/\//.test(url) ? ' rel="noopener noreferrer"' : ""
      return `<a href="${url}"${rel}>${label}</a>`
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")

  codeSnippets.forEach((snippet, index) => {
    rendered = rendered.replace(`__CODE_${index}__`, snippet)
  })

  return rendered
}

function sanitizeHtml(html) {
  const allowedTags = new Set([
    "p",
    "h2",
    "h3",
    "ol",
    "ul",
    "li",
    "strong",
    "em",
    "code",
    "pre",
    "a",
    "blockquote",
    "figure",
    "figcaption",
    "img",
    "xml",
    "plist",
    "dict",
    "key",
    "string",
    "array",
    "true",
  ])

  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/ on[a-z]+="[^"]*"/gi, "")
    .replace(/ on[a-z]+='[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/<\/*([a-z0-9:-]+)([^>]*)>/gi, (match, rawTag, rawAttrs) => {
      const tag = rawTag.toLowerCase()
      if (!allowedTags.has(tag)) {
        return escapeHtml(match)
      }

      if (match.startsWith("</")) {
        return `</${tag}>`
      }

      let attrs = rawAttrs || ""
      if (tag === "a") {
        const hrefMatch = attrs.match(/\shref=(["'])(.*?)\1/i)
        if (!hrefMatch) {
          return `<${tag}>`
        }

        const href = escapeAttribute(hrefMatch[2])
        const rel = /^https?:\/\//i.test(href) ? ' rel="noopener noreferrer"' : ""
        return `<a href="${href}"${rel}>`
      }

      if (tag === "img") {
        const srcMatch = attrs.match(/\ssrc=(["'])(.*?)\1/i)
        if (!srcMatch) {
          return ""
        }

        const altMatch = attrs.match(/\salt=(["'])(.*?)\1/i)
        const src = escapeAttribute(srcMatch[2])
        const alt = altMatch ? escapeAttribute(altMatch[2]) : ""
        return `<img src="${src}" alt="${alt}" />`
      }

      return `<${tag}>`
    })
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

      html.push(sanitizeHtml(rawHtml.join("\n")))
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

function isoDate(value) {
  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value
  return new Date(normalizedValue).toISOString()
}

function escapeAttribute(value) {
  return String(value).replace(/"/g, "&quot;")
}

function renderJsonLd(data) {
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`
}

function createSocialCard(title, description) {
  const safeTitle = escapeHtml(title)
  const safeDescription = escapeHtml(description)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" role="img" aria-label="${safeTitle}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b1220" />
      <stop offset="100%" stop-color="#111827" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7dd3fc" />
      <stop offset="100%" stop-color="#38bdf8" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />
  <rect x="72" y="72" width="1056" height="486" rx="28" fill="rgba(15, 23, 42, 0.55)" stroke="rgba(125, 211, 252, 0.25)" />
  <text x="116" y="154" fill="#7dd3fc" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="4">JARRETT WILLIAMS</text>
  <text x="116" y="252" fill="#f8fafc" font-family="'Source Serif 4', Georgia, serif" font-size="66" font-weight="700">${safeTitle}</text>
  <text x="116" y="334" fill="#cbd5e1" font-family="Inter, Arial, sans-serif" font-size="28">${safeDescription}</text>
  <text x="116" y="488" fill="#94a3b8" font-family="Inter, Arial, sans-serif" font-size="28">IT operations, systems engineering, Azure, and practical automation</text>
  <circle cx="1030" cy="162" r="54" fill="url(#accent)" />
  <path d="M1004 170c12-18 34-31 59-27-9 11-12 24-10 38 3 23 18 35 26 43-23 6-44 0-58-15-12-13-18-30-17-39z" fill="#0b1220"/>
  <path d="M990 214c-19 5-36 1-49-12 7-10 18-16 30-16 8 0 15 2 22 8 5 5 9 12 11 20h-14z" fill="#0b1220"/>
</svg>`
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

function pageTemplate({ title, description, content, canonicalPath, socialImagePath = site.socialImagePath, jsonLd = "", robots = "index,follow,max-image-preview:large" }) {
  const canonicalUrl = canonicalPath ? `${site.url}${canonicalPath}` : site.url
  const socialImageUrl = toAbsoluteUrl(socialImagePath)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="${robots}" />
    <meta name="author" content="${escapeHtml(site.author)}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:site_name" content="${escapeHtml(site.title)}" />
    <meta property="og:locale" content="${site.locale}" />
    <meta property="og:image" content="${socialImageUrl}" />
    <meta property="og:image:alt" content="${escapeHtml(title)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${socialImageUrl}" />
    <meta name="theme-color" content="#0b1220" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="alternate" type="application/atom+xml" title="${escapeHtml(site.title)} Feed" href="/feed.xml" />
    <link rel="stylesheet" href="/assets/styles.css" />
    <script src="/assets/consent.js" defer></script>
    ${jsonLd}
  </head>
  <body>
    <div class="site-shell">
      <header class="site-header">
        <div class="brand-block">
          <a class="brand" href="/">Jarrett Williams</a>
          <p class="tagline">IT operations, systems engineering, Azure, and practical automation</p>
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
      <img src="/assets/images/hero-circuit.svg" alt="Illustrated circuit board and infrastructure diagram" />
    </div>
  </section>
  <section class="split-grid">
    <div class="panel panel-image">
      <img src="/assets/images/server-racks.svg" alt="Illustrated server racks with cables and status lights" />
    </div>
    <div class="panel panel-copy">
      <p class="eyebrow">About</p>
      <h2>Built for useful answers, not filler.</h2>
      <p>This site is a running notebook for the operational side of IT, the systems engineering work behind Azure environments, and the practical side of AI automation that has to work outside of demos.</p>
      <p>I work across IT Operations and as a Staff Systems Engineer, so the write-ups here tend to come from real migrations, identity cleanup, infrastructure decisions, automation work, and the field notes that rarely fit neatly into vendor docs.</p>
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

function baseStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.title,
    url: site.url,
    description: site.description,
    author: {
      "@type": "Person",
      name: site.author,
      url: site.url,
      sameAs: [site.linkedin],
    },
  }
}

function homeStructuredData() {
  return [
    baseStructuredData(),
    {
      "@context": "https://schema.org",
      "@type": "Person",
      name: site.author,
      url: site.url,
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

function blogIndexStructuredData(posts) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: `${site.title} Blog`,
    url: `${site.url}/blog/`,
    description: site.description,
    publisher: {
      "@type": "Person",
      name: site.author,
    },
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      url: `${site.url}/blog/${post.slug}/`,
      datePublished: isoDate(post.date),
      author: {
        "@type": "Person",
        name: site.author,
      },
    })),
  }
}

function postStructuredData(post) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: isoDate(post.date),
    dateModified: isoDate(post.date),
    author: {
      "@type": "Person",
      name: site.author,
      url: site.url,
    },
    publisher: {
      "@type": "Person",
      name: site.author,
      url: site.url,
    },
    mainEntityOfPage: `${site.url}/blog/${post.slug}/`,
    image: [toAbsoluteUrl(site.socialImagePath)],
  }
}

function pageStructuredData(pageTitle, pagePath, description) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: pageTitle,
    url: `${site.url}${pagePath}`,
    description,
  }
}

function renderAbout() {
  return `<section class="split-grid">
    <div class="panel panel-image">
      <img src="/assets/images/server-room-tech.svg" alt="Illustrated technician working in a server room" />
    </div>
    <div class="panel panel-copy">
      <p class="eyebrow">About</p>
      <h1>A working notebook for infrastructure problems.</h1>
      <p>This site is a running notebook for the operational side of IT, the systems engineering work behind Azure environments, and the practical side of AI automation that has to work outside of demos.</p>
      <p>I work across IT Operations and staff-level systems engineering, with a background that spans healthcare, banking, higher education, and large-scale technology environments. Most of the work has lived where infrastructure, reliability, and practical execution all have to meet.</p>
      <p>That mix shows up here as endpoint administration, identity cleanup, networking, datacenter visits, Azure work, cloud migrations, and small but useful automations that save time when repeated work starts piling up.</p>
      <h2>A few professional highlights</h2>
      <p>The thread that runs through most of my work is building practical systems that hold up under real operational pressure, not just in ideal lab conditions.</p>
      <ul>
        <li>15+ years of infrastructure experience across cloud, networking, data center operations, and highly regulated environments.</li>
        <li>Leading infrastructure strategy for healthcare systems, including enterprise network, voice, security, and storage administration.</li>
        <li>Managing cloud and identity modernization work, including legacy platform migrations and OKTA rollout in banking.</li>
        <li>Building operational programs at Amazon, from deployment strategy for early Amazon Go systems to device-lab infrastructure and vendor support workflows.</li>
        <li>Delivering large-scale infrastructure improvements such as campus data center commissioning, phone-system migrations, and security and ITSM process rollouts.</li>
      </ul>
      <p>The goal is simple: leave behind useful write-ups that save someone else a few hours of trial, error, and tab-hoarding.</p>
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

function writeHeadersFile() {
  const headers = `/*
  Content-Security-Policy: default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  X-Robots-Tag: index, follow

/feed.xml
  Content-Type: application/atom+xml; charset=utf-8

/sitemap.xml
  Content-Type: application/xml; charset=utf-8

/robots.txt
  Content-Type: text/plain; charset=utf-8
`

  fs.writeFileSync(path.join(distDir, "_headers"), headers)
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
  fs.copyFileSync(faviconPath, path.join(distDir, "favicon.svg"))
  copyDir(imagesSrcDir, imagesDistDir)
  writeConsentScript()
  fs.writeFileSync(path.join(assetsDir, "social-card.svg"), createSocialCard(site.title, site.description))
  writeHeadersFile()

  writePage(
    "index.html",
    pageTemplate({
      title: `${site.title} | IT Operations and Infrastructure`,
      description: site.description,
      canonicalPath: "",
      content: renderHome(posts),
      jsonLd: homeStructuredData().map(renderJsonLd).join(""),
    })
  )

  writePage(
    path.join("blog", "index.html"),
    pageTemplate({
      title: `Blog | ${site.title}`,
      description: site.description,
      canonicalPath: "/blog/",
      content: renderBlogIndex(posts),
      jsonLd: renderJsonLd(blogIndexStructuredData(posts)),
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
        jsonLd: renderJsonLd(postStructuredData(post)),
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
      jsonLd: renderJsonLd(pageStructuredData(`About | ${site.title}`, "/about/", site.description)),
    })
  )

  writePage(
    path.join("privacy", "index.html"),
    pageTemplate({
      title: `Privacy | ${site.title}`,
      description: site.description,
      canonicalPath: "/privacy/",
      content: renderPrivacy(),
      robots: "noindex,follow,max-image-preview:large",
      jsonLd: renderJsonLd(pageStructuredData(`Privacy | ${site.title}`, "/privacy/", "Privacy policy for jarrettwilliams.com")),
    })
  )

  writePage(
    path.join("cookies", "index.html"),
    pageTemplate({
      title: `Cookies | ${site.title}`,
      description: "Cookie policy for jarrettwilliams.com",
      canonicalPath: "/cookies/",
      content: renderCookies(),
      robots: "noindex,follow,max-image-preview:large",
      jsonLd: renderJsonLd(pageStructuredData(`Cookies | ${site.title}`, "/cookies/", "Cookie policy for jarrettwilliams.com")),
    })
  )

  fs.writeFileSync(
    path.join(distDir, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`
  )

  const sitemapEntries = [
    { path: "", lastmod: new Date().toISOString() },
    { path: "/blog/", lastmod: new Date().toISOString() },
    { path: "/about/", lastmod: new Date().toISOString() },
    ...posts.map((post) => ({ path: `/blog/${post.slug}/`, lastmod: isoDate(post.date) })),
  ]
    .map((entry) => `<url><loc>${site.url}${entry.path}</loc><lastmod>${entry.lastmod}</lastmod></url>`)
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
      robots: "noindex,nofollow",
      jsonLd: renderJsonLd(pageStructuredData(`Not Found | ${site.title}`, "/404", site.description)),
    })
  )

  console.log(`Built ${posts.length} posts into ${distDir}`)
}

build()
