import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

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
  <rect width="1200" height="630" fill="#0c0f17" />
  <rect x="72" y="72" width="1056" height="486" rx="8" fill="#11151f" stroke="#1f2937" stroke-width="2" />
  <text x="116" y="148" fill="#7dd3fc" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="600" letter-spacing="1.5">JARRETT WILLIAMS</text>
  <text x="116" y="240" fill="#e5e7eb" font-family="'Source Serif 4', Georgia, serif" font-size="52" font-weight="600">${safeTitle}</text>
  <text x="116" y="308" fill="#94a3b8" font-family="Inter, Arial, sans-serif" font-size="22">${safeDescription}</text>
  <text x="116" y="470" fill="#64748b" font-family="Inter, Arial, sans-serif" font-size="20">IT operations, systems engineering, and practical notes</text>
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

function pageTemplate({ title, description, content, canonicalPath, socialImagePath = site.socialImagePath, jsonLd = "", robots = "index,follow,max-image-preview:large", ogType = "website", postDate = null }) {
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
    <meta property="og:type" content="${ogType}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:site_name" content="${escapeHtml(site.title)}" />
    <meta property="og:locale" content="${site.locale}" />
    <meta property="og:image" content="${socialImageUrl}" />
    <meta property="og:image:alt" content="${escapeHtml(title)}" />
    ${ogType === "article" && postDate ? `<meta property="article:published_time" content="${isoDate(postDate)}" />` : ""}
    ${ogType === "article" ? `<meta property="article:author" content="${escapeHtml(site.author)}" />` : ""}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${socialImageUrl}" />
    <meta name="theme-color" content="#0b1220" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..700&display=swap" rel="stylesheet" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="alternate" type="application/atom+xml" title="${escapeHtml(site.title)} Feed" href="/feed.xml" />
    <link rel="stylesheet" href="/assets/${site.cssFilename}" />
    <script src="/assets/consent.js" defer></script>
    <script type="speculationrules">
      {
        "prefetch": [{
          "tag": "prefetch-speculations",
          "where": { "href_matches": "/*" },
          "eagerness": "eager"
        }],
        "prerender": [{
          "tag": "prerender-speculations",
          "where": { "href_matches": "/*" },
          "eagerness": "moderate"
        }]
      }
    </script>
    ${jsonLd}
  </head>
  <body>
    <div class="site-shell">
      <header class="site-header">
        <div class="brand-block">
          <a class="brand" href="/">Jarrett Williams</a>
          <p class="tagline">IT operations, systems engineering, and practical notes</p>
        </div>
        <nav class="nav" aria-label="Main Navigation">
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
    <section class="cookie-banner" data-cookie-banner role="region" aria-label="Cookie Consent" hidden>
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
  const recent = posts.slice(0, 4)
  const list = recent
    .map(
      (post) => `<article class="post-preview">
        <time datetime="${post.date}">${formatDate(post.date)}</time>
        <h3><a href="/blog/${post.slug}/">${escapeHtml(post.title)}</a></h3>
        <p>${escapeHtml(post.description)}</p>
      </article>`
    )
    .join("")

  return `
    <div class="home-intro">
      <p>Practical write-ups from the infrastructure side of IT. Notes on endpoint work, identity systems, networking, datacenter visits, and the decisions that keep systems running in production.</p>
      <p>This is a personal collection of field notes and practical solutions. No filler.</p>
    </div>

    <section class="recent-posts">
      <div class="section-header">
        <h2>Recent posts</h2>
        <a href="/blog/">View all →</a>
      </div>
      <div class="post-list">${list}</div>
    </section>

    <div class="home-about">
      <p>I’m Jarrett Williams, a Staff Systems Engineer with 15+ years across IT operations, cloud, and infrastructure. <a href="/about/">More about me →</a></p>
    </div>
  `
}

function renderBlogIndex(posts) {
  const list = posts
    .map(
      (post) => `<article class="post-preview">
        <time datetime="${post.date}">${formatDate(post.date)}</time>
        <h3><a href="/blog/${post.slug}/">${escapeHtml(post.title)}</a></h3>
        <p>${escapeHtml(post.description)}</p>
      </article>`
    )
    .join("")

  return `
    <div class="page-intro">
      <h1>Blog</h1>
      <p>Notes, walkthroughs, and practical fixes from real IT operations and systems engineering work.</p>
    </div>
    <div class="post-list">${list}</div>
  `
}

function renderPost(post) {
  return `<article>
    <div class="post-header">
      <time datetime="${post.date}">${formatDate(post.date)}</time>
      <h1>${escapeHtml(post.title)}</h1>
    </div>
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
  return `<div class="about-layout">
    <aside class="about-sidebar">
      <div class="about-profile-card">
        <div class="about-avatar-placeholder">JW</div>
        <h2>Jarrett Williams</h2>
        <p>Staff Systems Engineer</p>
        <ul class="about-details-list">
          <li><span>Role</span><span>Staff Engineer</span></li>
          <li><span>Focus</span><span>Systems &amp; Infra</span></li>
          <li><span>Experience</span><span>15+ Years</span></li>
          <li><span>Location</span><span>United States</span></li>
        </ul>
      </div>
    </aside>
    <article class="about-narrative">
      <p class="eyebrow">About</p>
      <h1>A working notebook for infrastructure problems.</h1>
      <p>This site is a running notebook for the operational side of IT — the systems engineering work behind Azure environments, endpoint administration, and the practical fixes that rarely fit neatly into vendor docs.</p>
      <p>I work across IT Operations and as a Staff Systems Engineer, so the write-ups here tend to come from real migrations, identity cleanup, infrastructure decisions, automation, and field notes from datacenter visits.</p>
      <h2>Professional Focus &amp; Experience</h2>
      <p>The thread that runs through most of my work is building practical systems that hold up under real operational pressure, not just in ideal lab conditions.</p>
      <ul>
        <li><strong>Enterprise Operations:</strong> Over 15 years of infrastructure experience across cloud environments, networking, data center operations, and highly regulated industries.</li>
        <li><strong>Infrastructure Strategy:</strong> Led architecture for healthcare systems, including enterprise network, voice, security, and storage administration.</li>
        <li><strong>Identity &amp; Cloud Modernization:</strong> Managed migrations from legacy platforms, identity consolidation, and Okta deployments in banking environments.</li>
        <li><strong>Scale &amp; Automation:</strong> Built operational programs at Amazon, from deployment strategy for early Amazon Go systems to device-lab infrastructure and vendor support workflows.</li>
        <li><strong>Data Center Engineering:</strong> Delivered large-scale infrastructure improvements such as campus data center commissioning, phone-system migrations, and security/ITSM process rollouts.</li>
      </ul>
      <h2>About this blog</h2>
      <p>This site is built as a static publishing site to keep it fast, light, and private. It doesn't track you, load dynamic ads, or require cookies for reading. The goal is simple: leave behind useful, tested write-ups that save someone else a few hours of trial, error, and tab-hoarding.</p>
    </article>
  </div>`
}

function renderPrivacy() {
  return `
    <h1>Privacy policy</h1>
    <div class="post-content">
      <p>This site is a simple content site. It is not built around accounts, comments, or user dashboards.</p>
      <p>Basic server logs or analytics may be collected by the hosting platform to keep the site running and understand general traffic patterns.</p>
      <p>No personal information is intentionally sold or shared for advertising purposes through this site.</p>
      <p>If that changes, this page should be updated to reflect it clearly.</p>
    </div>
  `
}

function renderCookies() {
  return `
    <h1>Cookie policy</h1>
    <div class="post-content">
      <p>This site is a static publishing site and keeps its data collection intentionally light.</p>
      <p>The site may use essential browser storage to remember choices such as your cookie preference. That storage helps the site avoid showing the same prompt on every visit.</p>
      <p>No advertising, profiling, or third-party tracking cookies are intentionally loaded by this site today.</p>
      <p>If optional analytics or similar tools are added later, they should only run after an accepted choice and this page should be updated to describe them clearly.</p>
      <p>You can change your choice at any time by clearing site storage in your browser and revisiting the site.</p>
    </div>
  `
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
  Content-Security-Policy: default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline'; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests
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
  
  // Read and hash CSS for cache busting
  const cssContent = fs.readFileSync(stylesPath, "utf8")
  const cssHash = crypto.createHash("md5").update(cssContent).digest("hex").slice(0, 8)
  const cssFilename = `styles.${cssHash}.css`
  fs.writeFileSync(path.join(assetsDir, cssFilename), cssContent)
  site.cssFilename = cssFilename

  fs.copyFileSync(faviconPath, path.join(distDir, "favicon.svg"))
  copyDir(imagesSrcDir, imagesDistDir)
  writeConsentScript()
  fs.writeFileSync(path.join(assetsDir, "social-card.svg"), createSocialCard(site.title, site.description))
  writeHeadersFile()

  writePage(
    "index.html",
    pageTemplate({
      title: `${site.title}`,
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
        ogType: "article",
        postDate: post.date,
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
      content: `<h1>Page not found</h1><p class="intro">The page you were looking for is not here.</p><p><a class="button button-primary" href="/">Back home</a></p>`,
      robots: "noindex,nofollow",
      jsonLd: renderJsonLd(pageStructuredData(`Not Found | ${site.title}`, "/404", site.description)),
    })
  )

  console.log(`Built ${posts.length} posts into ${distDir}`)
}

build()
