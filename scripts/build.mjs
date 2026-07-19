import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { createSocialCardPng } from "./make-social-card.mjs"

const rootDir = process.cwd()
const contentDir = path.join(rootDir, "content", "posts")
const distDir = path.join(rootDir, "dist")
const assetsDir = path.join(distDir, "assets")
const stylesPath = path.join(rootDir, "src", "styles.css")
const faviconPath = path.join(rootDir, "src", "favicon.svg")
const imagesSrcDir = path.join(rootDir, "src", "images")
const imagesDistDir = path.join(assetsDir, "images")
const fontsSrcDir = path.join(rootDir, "src", "fonts")
const fontsDistDir = path.join(assetsDir, "fonts")

const site = {
  title: "Jarrett Williams",
  description:
    "Practical notes on IT operations, systems engineering, Azure, automation, networking, and datacenter work.",
  url: "https://jarrettwilliams.com",
  author: "Jarrett Williams",
  locale: "en_US",
  linkedin: "https://www.linkedin.com/in/jarrettwilliams/",
  // Raster PNG card (committed under src/images/, regenerated via
  // `node scripts/make-social-card.mjs`). PNG because most social platforms
  // refuse to render an SVG og:image.
  socialImagePath: "/assets/images/social-card.png",
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

function generatePostSocialCards(posts) {
  ensureDir(imagesDistDir)

  for (const post of posts) {
    const png = createSocialCardPng({ title: post.title })
    const hash = crypto.createHash("md5").update(png).digest("hex").slice(0, 8)
    const filename = `social-card-${post.slug}.${hash}.png`
    fs.writeFileSync(path.join(imagesDistDir, filename), png)
    post.socialImagePath = `/assets/images/${filename}`
  }
}

function renderInlineMarkdown(value) {
  const codeSnippets = []

  // Extract code spans from RAW text first (escaped exactly once below) so code
  // containing <, >, & or $ is not double-escaped. The NUL-byte sentinel (\u0000)
  // cannot appear in authored prose and survives escapeHtml, so restore never collides.
  let rendered = value.replace(/`([^`]+)`/g, (_match, code) => {
    const token = `\u0000${codeSnippets.length}\u0000`
    codeSnippets.push(`<code>${escapeHtml(code)}</code>`)
    return token
  })

  rendered = escapeHtml(rendered)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label, url) => {
      return `<a href="${escapeAttribute(url)}" rel="noopener noreferrer">${label}</a>`
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")

  // Function replacer (not a string) so "$" sequences inside code stay literal.
  rendered = rendered.replace(/\u0000(\d+)\u0000/g, (_match, index) => codeSnippets[Number(index)])

  return rendered
}

// Decodes numeric and a few named HTML entities so a scheme cannot be smuggled
// past the URL allowlist via encoding (e.g. "javascript&#58;alert(1)").
function decodeEntities(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);?/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&colon;/gi, ":")
    .replace(/&tab;|&newline;/gi, "")
    .replace(/&amp;/gi, "&")
}

// Allowlist of URL schemes for sanitized <a>/<img>. Relative, root-relative,
// anchor and query URLs are allowed; otherwise only http/https/mailto. Control
// and whitespace chars are stripped first so they cannot split a scheme.
function isSafeUrl(value) {
  const decoded = decodeEntities(value).replace(/[\u0000-\u0020]+/g, "").toLowerCase()
  if (!/^[a-z][a-z0-9+.-]*:/.test(decoded)) {
    return true // no explicit scheme -> relative/anchor/path URL
  }
  return /^(?:https?:|mailto:)/.test(decoded)
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
    // Neutralize any "<" that opens a tag-like token but is never closed before
    // the next "<" or end of input. Such malformed tags slip past the
    // reconstruction pass below (which requires a closing ">") and could later
    // be completed by an unrelated ">" elsewhere in the document.
    .replace(/<(?=[/!a-z])(?![^<]*>)/gi, "&lt;")
    // Strip inline event handlers, including UNQUOTED values (on...=foo).
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
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
        if (!hrefMatch || !isSafeUrl(hrefMatch[2])) {
          return `<${tag}>`
        }

        const href = escapeAttribute(hrefMatch[2])
        const rel = /^https?:\/\//i.test(decodeEntities(hrefMatch[2]).trim())
          ? ' rel="noopener noreferrer"'
          : ""
        return `<a href="${href}"${rel}>`
      }

      if (tag === "img") {
        const srcMatch = attrs.match(/\ssrc=(["'])(.*?)\1/i)
        if (!srcMatch || !isSafeUrl(srcMatch[2])) {
          return ""
        }

        const altMatch = attrs.match(/\salt=(["'])(.*?)\1/i)
        const src = escapeAttribute(srcMatch[2])
        const alt = altMatch ? escapeAttribute(altMatch[2]) : ""

        // Preserve dimensions (prevents layout shift) and lazy-loading.
        const widthMatch = attrs.match(/\swidth=(["'])(\d{1,5})\1/i)
        const heightMatch = attrs.match(/\sheight=(["'])(\d{1,5})\1/i)
        const dims =
          (widthMatch ? ` width="${widthMatch[2]}"` : "") +
          (heightMatch ? ` height="${heightMatch[2]}"` : "")
        const loadingMatch = attrs.match(/\sloading=(["'])(lazy|eager)\1/i)
        const loading = ` loading="${loadingMatch ? loadingMatch[2].toLowerCase() : "lazy"}"`
        const decoding = ' decoding="async"'

        return `<img src="${src}" alt="${alt}"${dims}${loading}${decoding} />`
      }

      return `<${tag}>`
    })
}

// ---- Build-time syntax highlighting (class-based; CSP-safe, no inline styles) ----
// Operates on RAW code and escapes every emitted chunk, so highlighted output is
// HTML-safe and never routed through sanitizeHtml. Token colors live in styles.css.

function normalizeLang(lang) {
  const l = (lang || "").trim().toLowerCase()
  if (["bash", "sh", "shell", "shell-session", "console", "zsh"].includes(l)) return "shell"
  if (["powershell", "pwsh", "ps", "ps1"].includes(l)) return "powershell"
  if (["json"].includes(l)) return "json"
  if (["yaml", "yml"].includes(l)) return "yaml"
  if (["js", "javascript", "ts", "typescript", "jsonc"].includes(l)) return "jslike"
  return ""
}

const HIGHLIGHT_RULES = {
  shell: [
    ["comment", /#.*/y],
    ["string", /"(?:\\.|[^"\\])*"|'[^']*'/y],
    ["var", /\$\{[^}]*\}|\$[A-Za-z_]\w*/y],
    ["flag", /(?<=^|\s)--?[A-Za-z][\w-]*/y],
    ["keyword", /\b(?:if|then|else|elif|fi|for|in|do|done|while|case|esac|function|return|export|local|sudo|echo|cd|set)\b/y],
    ["num", /\b\d+\b/y],
  ],
  powershell: [
    ["comment", /#.*/y],
    ["string", /"(?:`.|[^"])*"|'[^']*'/y],
    ["var", /\$[A-Za-z_:][\w:]*/y],
    ["fn", /\b[A-Z][a-z]+-[A-Z][A-Za-z]+\b/y],
    ["flag", /(?<=\s)-[A-Za-z]\w*/y],
    ["num", /\b\d+\b/y],
  ],
  json: [
    ["key", /"(?:\\.|[^"\\])*"(?=\s*:)/y],
    ["string", /"(?:\\.|[^"\\])*"/y],
    ["bool", /\b(?:true|false|null)\b/y],
    ["num", /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y],
  ],
  yaml: [
    ["comment", /#.*/y],
    ["key", /(?<=^|\n)\s*[A-Za-z_][\w.-]*(?=\s*:)/y],
    ["string", /"(?:\\.|[^"\\])*"|'[^']*'/y],
    ["bool", /\b(?:true|false|null|yes|no)\b/y],
    ["num", /\b\d+(?:\.\d+)?\b/y],
  ],
  jslike: [
    ["comment", /\/\/.*|\/\*[\s\S]*?\*\//y],
    ["string", /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/y],
    ["keyword", /\b(?:const|let|var|function|return|if|else|for|while|import|export|from|class|new|await|async|try|catch|throw|typeof)\b/y],
    ["bool", /\b(?:true|false|null|undefined)\b/y],
    ["num", /\b\d+(?:\.\d+)?\b/y],
  ],
}

function highlightCode(code, lang) {
  const rules = HIGHLIGHT_RULES[normalizeLang(lang)]
  if (!rules) return escapeHtml(code)
  let out = ""
  let i = 0
  while (i < code.length) {
    let matched = false
    for (const [cls, re] of rules) {
      re.lastIndex = i
      const m = re.exec(code)
      if (m && m.index === i && m[0].length > 0) {
        out += `<span class="tok-${cls}">${escapeHtml(m[0])}</span>`
        i += m[0].length
        matched = true
        break
      }
    }
    if (!matched) {
      out += escapeHtml(code[i])
      i += 1
    }
  }
  return out
}

// Strips inline markdown/html so a heading's text can become a slug or plain TOC label.
function stripInline(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_]/g, "")
    .replace(/<[^>]+>/g, "")
    .trim()
}

function uniqueHeadingId(text, used) {
  const base = slugify(stripInline(text)) || "section"
  let id = base
  let n = 2
  while (used.has(id)) {
    id = `${base}-${n}`
    n += 1
  }
  used.add(id)
  return id
}

// Returns { html, headings } where headings is [{ level, text, id }] for h2/h3.
function renderMarkdown(content) {
  const lines = content.replace(/\r\n/g, "\n").split("\n")
  const html = []
  const headings = []
  const usedIds = new Set()
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim()
      const codeLines = []
      index += 1

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index])
        index += 1
      }

      if (index < lines.length) {
        index += 1
      }

      const code = codeLines.join("\n")
      const langClass = normalizeLang(lang) ? ` class="language-${normalizeLang(lang)}"` : ""
      const label = lang ? `<span class="code-lang">${escapeHtml(lang)}</span>` : ""
      html.push(`<div class="code-block">${label}<pre><code${langClass}>${highlightCode(code, lang)}</code></pre></div>`)
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
      const inner = renderInlineMarkdown(headingMatch[2])
      if (level === 2 || level === 3) {
        const id = uniqueHeadingId(headingMatch[2], usedIds)
        headings.push({ level, text: stripInline(headingMatch[2]), id })
        html.push(`<h${level} id="${id}"><a class="heading-anchor" href="#${id}" aria-label="Link to this section">#</a>${inner}</h${level}>`)
      } else {
        html.push(`<h${level}>${inner}</h${level}>`)
      }
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

  return { html: html.join("\n"), headings }
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

// Renders structured data as an INLINE <script type="application/ld+json"> block.
//
// Note on CSP: a <script> whose type is not a JavaScript MIME type (here
// application/ld+json) is an HTML "data block" — the browser never executes it,
// so it is NOT subject to the script-src directive. That means inline JSON-LD
// works under our strict `script-src 'self'` CSP with no 'unsafe-inline' and no
// hash. (An external `src` is silently ignored for data blocks per the HTML
// spec, which previously dropped our structured data entirely.) The JSON is
// escaped for the one sequence that can break out of a script element: "</".
function renderJsonLd(data) {
  const items = Array.isArray(data) ? data : [data]
  const json = JSON.stringify(items).replace(/<\//g, "<\\/")
  return `<script type="application/ld+json">${json}</script>`
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
      const { html, headings } = renderMarkdown(body)

      // Tags: comma-separated frontmatter; keep a display label + a slug each.
      const tags = (metadata.tags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((label) => ({ label, slug: slugify(label) }))
        .filter((tag) => tag.slug)

      // Reading time: ~220 wpm over the prose word count (min 1).
      const words = body.replace(/```[\s\S]*?```/g, " ").split(/\s+/).filter(Boolean).length
      const readingMinutes = Math.max(1, Math.round(words / 220))

      return {
        title: metadata.title || basename,
        date: metadata.date || "1970-01-01",
        description: metadata.description || "",
        slug,
        body,
        html,
        headings,
        tags,
        readingMinutes,
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
    <meta name="theme-color" content="#0a0b10" />
    <link rel="preload" href="/assets/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/assets/fonts/source-serif-4-var.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="alternate" type="application/atom+xml" title="${escapeHtml(site.title)} Feed" href="/feed.xml" />
    <link rel="alternate" type="application/feed+json" title="${escapeHtml(site.title)} JSON Feed" href="/feed.json" />
    <link rel="stylesheet" href="/assets/${site.cssFilename}" />
    <script src="/assets/${site.consentFilename}" defer></script>
    <script src="/assets/${site.searchFilename}" defer></script>
    <script type="speculationrules" src="/assets/${site.speculationFilename}"></script>
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
          <a href="/"${canonicalPath === "" ? ' aria-current="page"' : ""}>Home</a>
          <a href="/blog/"${/^\/(blog|tags)\//.test(canonicalPath) ? ' aria-current="page"' : ""}>Blog</a>
          <a href="/about/"${canonicalPath === "/about/" ? ' aria-current="page"' : ""}>About</a>
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

// Shared listing card with date, reading time, tag chips, and a stretched link
// so the whole card is clickable while tag chips stay independently clickable.
function renderPostCard(post, options = {}) {
  const featured = options.featured ? " post-card-featured" : ""
  const tags = post.tags
    .slice(0, 3)
    .map((tag) => `<a class="tag-chip" href="/tags/${tag.slug}/">${escapeHtml(tag.label)}</a>`)
    .join("")
  const searchText = escapeAttribute(
    [post.title, post.description, ...post.tags.map((tag) => tag.label)].join(" ").toLowerCase()
  )
  return `<article class="post-card${featured}" data-search-text="${searchText}">
    <div class="post-card-meta">
      <time datetime="${post.date}">${formatDate(post.date)}</time>
      <span class="dot" aria-hidden="true">&middot;</span>
      <span>${post.readingMinutes} min read</span>
    </div>
    <h3 class="post-card-title"><a href="/blog/${post.slug}/">${escapeHtml(post.title)}</a></h3>
    <p class="post-card-excerpt">${escapeHtml(post.description)}</p>
    ${tags ? `<div class="tag-row">${tags}</div>` : ""}
  </article>`
}

function renderSearch() {
  return `<div class="search" data-search>
    <label class="visually-hidden" for="site-search">Search posts</label>
    <input id="site-search" class="search-input" type="search" placeholder="Search posts&hellip;" autocomplete="off" data-search-input />
    <p class="search-empty" data-search-empty hidden>No posts match your search.</p>
  </div>`
}

function renderHome(posts) {
  const [lead, ...rest] = posts
  const featured = lead ? renderPostCard(lead, { featured: true }) : ""
  const grid = rest.slice(0, 4).map((post) => renderPostCard(post)).join("")

  return `
    <section class="home-hero">
      <p class="eyebrow">Jarrett Williams &middot; Staff Systems Engineer</p>
      <h1>Field notes on <span class="accent-text">infrastructure</span>, identity, and keeping systems stable.</h1>
      <p class="lede">A running notebook from across IT operations, cloud architecture, and automation &mdash; real migrations, identity cleanup, and the practical fixes that rarely fit neatly into vendor docs.</p>
      <div class="hero-actions">
        <a class="button button-primary" href="/blog/">Read the blog</a>
        <a class="text-link" href="/about/">About me &rarr;</a>
      </div>
    </section>

    <section class="listing-section">
      <div class="section-heading">
        <h2>Latest writing</h2>
        <a class="text-link" href="/blog/">All posts &rarr;</a>
      </div>
      ${featured}
      <div class="post-grid post-grid-2">${grid}</div>
    </section>
  `
}

function renderBlogIndex(posts, allTags) {
  const cards = posts.map((post) => renderPostCard(post)).join("")
  const filters = allTags
    .map(
      (tag) =>
        `<a class="tag-chip" href="/tags/${tag.slug}/">${escapeHtml(tag.label)} <span class="tag-count">${tag.count}</span></a>`
    )
    .join("")

  return `
    <section class="page-intro">
      <p class="eyebrow">Blog</p>
      <h1>Posts &amp; walkthroughs</h1>
      <p class="lede">Real notes from endpoint work, datacenter visits, identity cleanup, and the systems work that usually has to be figured out in motion.</p>
    </section>
    ${renderSearch()}
    ${allTags.length ? `<nav class="tag-filter" aria-label="Filter by topic"><span class="tag-filter-label">Topics</span>${filters}</nav>` : ""}
    <section class="listing-section">
      <div class="post-grid post-grid-2" data-search-grid>${cards}</div>
    </section>
  `
}

function renderToc(headings) {
  const items = headings
    .map(
      (heading) =>
        `<li class="toc-h${heading.level}"><a href="#${heading.id}">${escapeHtml(heading.text)}</a></li>`
    )
    .join("")
  return `<nav class="post-toc" aria-label="Table of contents">
    <p class="post-toc-title">On this page</p>
    <ul>${items}</ul>
  </nav>`
}

function renderPrevNext(prev, next) {
  if (!prev && !next) {
    return ""
  }
  const cell = (post, dir, label) =>
    post
      ? `<a class="prevnext-link prevnext-${dir}" href="/blog/${post.slug}/">
          <span class="prevnext-label">${label}</span>
          <span class="prevnext-title">${escapeHtml(post.title)}</span>
        </a>`
      : `<span class="prevnext-spacer"></span>`
  return `<nav class="prevnext" aria-label="More posts">
    ${cell(prev, "prev", "&larr; Older")}
    ${cell(next, "next", "Newer &rarr;")}
  </nav>`
}

function getRelatedPosts(post, posts) {
  const tagSlugs = new Set(post.tags.map((tag) => tag.slug))

  return posts
    .filter((candidate) => candidate.slug !== post.slug)
    .map((candidate) => ({
      post: candidate,
      sharedTags: candidate.tags.filter((tag) => tagSlugs.has(tag.slug)).length,
    }))
    .filter((candidate) => candidate.sharedTags > 0)
    .sort(
      (a, b) =>
        b.sharedTags - a.sharedTags ||
        new Date(b.post.date).getTime() - new Date(a.post.date).getTime() ||
        a.post.slug.localeCompare(b.post.slug)
    )
    .slice(0, 3)
    .map((candidate) => candidate.post)
}

function renderRelatedPosts(posts) {
  if (!posts.length) {
    return ""
  }

  const cards = posts.map((post) => renderPostCard(post)).join("")
  return `<section class="listing-section" aria-labelledby="related-posts-heading">
    <div class="section-heading"><h2 id="related-posts-heading">Related</h2></div>
    <div class="post-grid post-grid-2">${cards}</div>
  </section>`
}

function renderPost(post, neighbors = {}) {
  const { prev, next, related = [] } = neighbors
  const toc = post.headings.length >= 3 ? renderToc(post.headings) : ""
  const tags = post.tags
    .map((tag) => `<a class="tag-chip" href="/tags/${tag.slug}/">${escapeHtml(tag.label)}</a>`)
    .join("")

  return `<div class="post-panel${toc ? " has-toc" : ""}">
    ${toc}
    <article class="post-article">
      <header class="post-masthead">
        <p class="eyebrow">Article</p>
        <h1>${escapeHtml(post.title)}</h1>
        <div class="post-meta">
          <time datetime="${post.date}">${formatDate(post.date)}</time>
          <span class="dot" aria-hidden="true">&middot;</span>
          <span>${post.readingMinutes} min read</span>
        </div>
      </header>
      <div class="post-content">${post.html}</div>
      <footer class="post-footer">
        ${tags ? `<div class="tag-row tag-row-footer">${tags}</div>` : ""}
        ${renderPrevNext(prev, next)}
        ${renderRelatedPosts(related)}
        <a class="text-link" href="/blog/">&larr; Back to all posts</a>
      </footer>
    </article>
  </div>`
}

function renderTagPage(tag, posts) {
  const cards = posts.map((post) => renderPostCard(post)).join("")
  return `
    <section class="page-intro">
      <p class="eyebrow">Topic</p>
      <h1>${escapeHtml(tag.label)}</h1>
      <p class="lede">${posts.length} post${posts.length === 1 ? "" : "s"} tagged &ldquo;${escapeHtml(tag.label)}&rdquo;.</p>
      <a class="text-link" href="/blog/">&larr; All posts</a>
    </section>
    <section class="listing-section">
      <div class="post-grid post-grid-2">${cards}</div>
    </section>
  `
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
    image: [toAbsoluteUrl(post.socialImagePath || site.socialImagePath)],
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

function buildConsentScript() {
  return `(() => {
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
}

// Client-side post search: filters server-rendered cards by their
// data-search-text attribute. No fetch, no innerHTML — CSP- and XSS-safe.
function buildSearchScript() {
  return `(() => {
  const root = document.querySelector("[data-search]");
  const grid = document.querySelector("[data-search-grid]");
  if (!root || !grid) return;
  const input = root.querySelector("[data-search-input]");
  const empty = root.querySelector("[data-search-empty]");
  if (!input) return;
  const cards = Array.prototype.slice.call(grid.querySelectorAll("[data-search-text]"));

  const apply = () => {
    const q = input.value.trim().toLowerCase();
    let visible = 0;
    cards.forEach((card) => {
      const match = !q || card.getAttribute("data-search-text").indexOf(q) !== -1;
      card.hidden = !match;
      if (match) visible += 1;
    });
    if (empty) empty.hidden = visible !== 0;
  };

  input.addEventListener("input", apply);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
    const active = document.activeElement;
    const typing = active && /^(input|textarea|select)$/i.test(active.tagName || "");
    if (!typing) {
      event.preventDefault();
      input.focus();
    }
  });
})();`
}

function writeHeadersFile() {
  const headers = `/*
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  X-Permitted-Cross-Domain-Policies: none
  Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  X-Robots-Tag: index, follow

# Everything under /assets/ is content-addressed (hashed CSS/JS/JSON) or
# content-stable (subset fonts, generated images), so it can be cached forever.
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/favicon.svg
  Cache-Control: public, max-age=604800

/feed.xml
  Content-Type: application/atom+xml; charset=utf-8

/feed.json
  Content-Type: application/feed+json; charset=utf-8

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

// Writes content to /assets/<name>.<hash><ext> and returns the hashed filename.
// Content-addressing lets every /assets/ file be cached immutably (see _headers).
function writeHashedAsset(basename, content) {
  const hash = crypto.createHash("md5").update(content).digest("hex").slice(0, 8)
  const dotIndex = basename.lastIndexOf(".")
  const filename = `${basename.slice(0, dotIndex)}.${hash}${basename.slice(dotIndex)}`
  fs.writeFileSync(path.join(assetsDir, filename), content)
  return filename
}

function build() {
  const posts = readPosts()
  cleanDir(distDir)
  ensureDir(assetsDir)
  
  // Hash long-lived assets so they can be served immutable (see _headers).
  site.cssFilename = writeHashedAsset("styles.css", fs.readFileSync(stylesPath, "utf8"))
  site.consentFilename = writeHashedAsset("consent.js", buildConsentScript())

  // External speculation rules (allows stricter CSP without 'unsafe-inline').
  // Unlike JSON-LD data blocks, speculation-rules DO honor an external `src`
  // (Chrome 121+), so this stays external and keeps script-src free of inline.
  // prefetch uses 'moderate' (not 'eager') to avoid prefetching every link on
  // load and overlapping with the prerender rule below.
  const speculationRules = {
    "prefetch": [{
      "tag": "prefetch-speculations",
      "where": { "href_matches": "/*" },
      "eagerness": "moderate"
    }],
    "prerender": [{
      "tag": "prerender-speculations",
      "where": { "href_matches": "/*" },
      "eagerness": "moderate"
    }]
  }
  site.speculationFilename = writeHashedAsset("speculationrules.json", JSON.stringify(speculationRules))

  // Aggregate tags across posts (by count, then label) for filters and tag pages.
  const tagMap = new Map()
  for (const post of posts) {
    for (const tag of post.tags) {
      const entry = tagMap.get(tag.slug) || { ...tag, count: 0, posts: [] }
      entry.count += 1
      entry.posts.push(post)
      tagMap.set(tag.slug, entry)
    }
  }
  const allTags = [...tagMap.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label)
  )

  // Client-side search filters the server-rendered cards by a data attribute, so
  // it needs no fetched index and never touches innerHTML (CSP- and XSS-safe).
  site.searchFilename = writeHashedAsset("search.js", buildSearchScript())

  fs.copyFileSync(faviconPath, path.join(distDir, "favicon.svg"))
  copyDir(imagesSrcDir, imagesDistDir)
  generatePostSocialCards(posts)
  copyDir(fontsSrcDir, fontsDistDir)
  writeHeadersFile()

  writePage(
    "index.html",
    pageTemplate({
      title: `${site.title}`,
      description: site.description,
      canonicalPath: "",
      content: renderHome(posts),
      jsonLd: renderJsonLd(homeStructuredData()),
    })
  )

  writePage(
    path.join("blog", "index.html"),
    pageTemplate({
      title: `Blog | ${site.title}`,
      description: site.description,
      canonicalPath: "/blog/",
      content: renderBlogIndex(posts, allTags),
      jsonLd: renderJsonLd(blogIndexStructuredData(posts)),
    })
  )

  posts.forEach((post, i) => {
    writePage(
      path.join("blog", post.slug, "index.html"),
      pageTemplate({
        title: `${post.title} | ${site.title}`,
        description: post.description,
        canonicalPath: `/blog/${post.slug}/`,
        socialImagePath: post.socialImagePath,
        content: renderPost(post, {
          prev: posts[i + 1],
          next: posts[i - 1],
          related: getRelatedPosts(post, posts),
        }),
        jsonLd: renderJsonLd(postStructuredData(post)),
        ogType: "article",
        postDate: post.date,
      })
    )
  })

  // One page per tag at /tags/<slug>/.
  for (const tag of allTags) {
    writePage(
      path.join("tags", tag.slug, "index.html"),
      pageTemplate({
        title: `${tag.label} | ${site.title}`,
        description: `Posts tagged ${tag.label} on ${site.title}.`,
        canonicalPath: `/tags/${tag.slug}/`,
        content: renderTagPage(tag, tag.posts),
        jsonLd: renderJsonLd(
          pageStructuredData(`${tag.label} | ${site.title}`, `/tags/${tag.slug}/`, `Posts tagged ${tag.label}.`)
        ),
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
    ...allTags.map((tag) => ({ path: `/tags/${tag.slug}/`, lastmod: new Date().toISOString() })),
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

  const jsonFeed = {
    version: "https://jsonfeed.org/version/1.1",
    title: site.title,
    home_page_url: `${site.url}/`,
    feed_url: `${site.url}/feed.json`,
    description: site.description,
    language: "en-US",
    authors: [{ name: site.author, url: `${site.url}/` }],
    items: posts.map((post) => ({
      id: `${site.url}/blog/${post.slug}/`,
      url: `${site.url}/blog/${post.slug}/`,
      title: post.title,
      content_html: post.html,
      summary: post.description,
      date_published: isoDate(post.date),
      tags: post.tags.map((tag) => tag.label),
      image: toAbsoluteUrl(post.socialImagePath),
    })),
  }
  fs.writeFileSync(path.join(distDir, "feed.json"), `${JSON.stringify(jsonFeed, null, 2)}\n`)

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
