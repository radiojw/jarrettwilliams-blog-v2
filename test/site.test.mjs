import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { fromHtml } from "hast-util-from-html"
import { sanitize } from "hast-util-sanitize"
import { toHtml } from "hast-util-to-html"
import { sanitizeSchema } from "../src/lib/sanitize-schema.mjs"

const projectRoot = fileURLToPath(new URL("..", import.meta.url))
const distRoot = path.join(projectRoot, "dist")

const buildResult = spawnSync("npm", ["run", "build"], {
  cwd: projectRoot,
  encoding: "utf8",
  timeout: 120000,
  env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
})

function walk(directory, predicate = () => true, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(entryPath, predicate, files)
    else if (predicate(entryPath)) files.push(entryPath)
  }
  return files
}

function relative(filePath) {
  return path.relative(distRoot, filePath).split(path.sep).join("/")
}

function pageUrlForHtml(htmlPath) {
  const relativePath = relative(htmlPath)
  if (relativePath === "index.html") return "https://jarrettwilliams.com/"
  if (relativePath === "404.html") return "https://jarrettwilliams.com/404.html"
  if (relativePath.endsWith("/index.html")) return `https://jarrettwilliams.com/${relativePath.slice(0, -10)}`
  return `https://jarrettwilliams.com/${relativePath}`
}

function localFileForUrl(url) {
  const pathname = decodeURIComponent(url.pathname)
  const relativePath = pathname.replace(/^\/+/, "")
  if (pathname.endsWith("/")) return path.join(distRoot, relativePath, "index.html")
  return path.join(distRoot, relativePath)
}

function postSlugs() {
  const postsDir = path.join(projectRoot, "content", "posts")
  return readdirSync(postsDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const raw = readFileSync(path.join(postsDir, name), "utf8")
      const match = raw.match(/^slug:\s*"?([^"\n]+)"?\s*$/m)
      assert.ok(match, `${name} is missing a slug`)
      return match[1].trim()
    })
}

function sanitizeHtml(html) {
  return toHtml(sanitize(fromHtml(html, { fragment: true }), sanitizeSchema))
}

function assertWellFormedXml(xml, filename, expectedRoot) {
  assert.match(xml, /^<\?xml\s+version=["']1\.0["']/i, `${filename} needs an XML declaration`)
  const withoutEntities = xml.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, "")
  assert.doesNotMatch(withoutEntities, /&/, `${filename} contains an unescaped ampersand`)
  const documentBody = xml.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "").trim()
  const tagPattern = /<(\/?)\s*([a-z_][\w:.-]*)(?:\s+(?:[^<>\/"']+|"[^"]*"|'[^']*')*)?\s*(\/?)>/gi
  const stack = []
  const roots = []
  let match
  let previousEnd = 0
  while ((match = tagPattern.exec(documentBody))) {
    const between = documentBody.slice(previousEnd, match.index)
    assert.doesNotMatch(between, /[<>]/, `${filename} contains malformed markup`)
    previousEnd = tagPattern.lastIndex
    const [, closing, tagName, selfClosing] = match
    if (closing) {
      assert.equal(stack.pop(), tagName, `${filename} has a mismatched </${tagName}>`)
    } else if (!selfClosing) {
      if (stack.length === 0) roots.push(tagName)
      stack.push(tagName)
    }
  }
  assert.deepEqual(stack, [], `${filename} has unclosed tags`)
  assert.deepEqual(roots, [expectedRoot], `${filename} must have one <${expectedRoot}> root`)
}

test("astro build writes a static dist", () => {
  assert.equal(buildResult.status, 0, `build failed\nstdout:\n${buildResult.stdout}\nstderr:\n${buildResult.stderr}`)
  assert.ok(existsSync(distRoot))
})

test("editorial routes, feeds, and real posts are present", () => {
  const required = [
    "index.html",
    "about/index.html",
    "blog/index.html",
    "privacy/index.html",
    "cookies/index.html",
    "404.html",
    "feed.xml",
    "feed.json",
    "sitemap.xml",
    "robots.txt",
    "_headers",
    "favicon.svg",
    "assets/fonts/source-serif-4-var.woff2",
    "assets/fonts/inter-var.woff2",
    "assets/theme.js",
    "assets/consent.js",
    "assets/search.js",
  ]
  for (const file of required) {
    assert.ok(existsSync(path.join(distRoot, file)), `missing ${file}`)
  }

  const slugs = postSlugs()
  assert.ok(slugs.length >= 6)
  for (const slug of slugs) {
    assert.ok(existsSync(path.join(distRoot, "blog", slug, "index.html")), `missing post ${slug}`)
    assert.ok(existsSync(path.join(distRoot, "assets", "images", `social-card-${slug}.png`)), `missing social card ${slug}`)
  }

  for (const tag of ["okta", "microsoft-intune", "macos", "datacenter", "cloudflare"]) {
    assert.ok(existsSync(path.join(distRoot, "tags", tag, "index.html")), `missing tag ${tag}`)
  }
})

test("homepage uses the editorial bottom nav and real notes", () => {
  const html = readFileSync(path.join(distRoot, "index.html"), "utf8")
  assert.match(html, /Field notes on infrastructure, identity, and keeping systems stable\./)
  assert.match(html, /Publishing a Static Site to Cloudflare Pages/)
  assert.doesNotMatch(html, /<header\b/)
  const mainAt = html.indexOf("<main")
  const navAt = html.indexOf('class="bottom-nav"')
  assert.ok(mainAt > 0 && navAt > mainAt, "bottom nav should follow the page content")
  assert.match(html, /aria-label="Primary"/)
  assert.match(html, /href="\/"[^>]*>Blog<\/a>/)
  assert.match(html, /href="\/about\/"[^>]*>About<\/a>/)
  assert.match(html, /href="\/blog\/"[^>]*>Notes<\/a>/)
  assert.match(html, /href="\/feed\.xml"[^>]*>RSS<\/a>/)
  assert.equal((html.match(/<nav\b/g) || []).length, 1)
})

test("inner pages keep the site name top-left and the nav at the bottom", () => {
  const html = readFileSync(path.join(distRoot, "about", "index.html"), "utf8")
  const header = html.match(/<header\b[\s\S]*?<\/header>/)?.[0] || ""
  assert.match(header, /class="wordmark"[^>]*>Jarrett Williams</)
  assert.doesNotMatch(header, /<nav\b/)
  assert.match(html, /Staff Systems Engineer/)
  assert.match(html, /class="bottom-nav"/)
  assert.ok(html.indexOf('class="bottom-nav"') > html.indexOf("<main"))
})

test("post pages render markdown, code, and the cloudflare figure", () => {
  const cloudflare = readFileSync(
    path.join(distRoot, "blog", "publishing-a-static-site-to-cloudflare-pages", "index.html"),
    "utf8",
  )
  assert.match(cloudflare, /id="what-cloudflare-pages-actually-does"/)
  assert.match(cloudflare, /class="language-bash"/)
  assert.match(cloudflare, /src="\/assets\/images\/cloudflare-pages-workflow\.svg"/)
  assert.match(cloudflare, /<figcaption>/)

  const okta = readFileSync(path.join(distRoot, "blog", "remove-empty-okta-groups", "index.html"), "utf8")
  assert.match(okta, /class="language-python"/)
  assert.match(okta, /class="token keyword"/)
})

test("search, consent, and theme hooks survive the build", () => {
  const notes = readFileSync(path.join(distRoot, "blog", "index.html"), "utf8")
  assert.match(notes, /data-search-input/)
  assert.match(notes, /data-search-grid/)
  assert.match(notes, /data-cookie-banner/)
  assert.match(notes, /data-theme-toggle/)
  assert.match(notes, /src="\/umami\/script\.js"/)
  assert.match(notes, /src="\/assets\/theme\.js"/)
})

test("pages avoid inline styles and executable inline scripts", () => {
  const htmlFiles = walk(distRoot, (file) => file.endsWith(".html"))
  assert.ok(htmlFiles.length > 0)
  for (const file of htmlFiles) {
    const html = readFileSync(file, "utf8")
    const name = relative(file)
    assert.doesNotMatch(html, /<style[\s>]/i, `${name} has an inline style tag`)
    assert.doesNotMatch(html, /\sstyle="/i, `${name} has a style attribute`)
    const scripts = html.match(/<script\b[^>]*>/gi) || []
    for (const tag of scripts) {
      const type = tag.match(/\stype="([^"]+)"/i)?.[1] || ""
      const src = tag.match(/\ssrc="([^"]+)"/i)?.[1] || ""
      if (type.includes("ld+json") || type.includes("speculationrules")) continue
      assert.ok(src.startsWith("/"), `${name} has an inline script: ${tag}`)
    }
  }
})

test("every internal href and src resolves inside dist", () => {
  const htmlFiles = walk(distRoot, (file) => file.endsWith(".html"))
  for (const htmlPath of htmlFiles) {
    const html = readFileSync(htmlPath, "utf8")
    for (const match of html.matchAll(/\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi)) {
      const rawReference = match[2].replace(/&amp;/gi, "&")
      assert.doesNotMatch(rawReference, /^(?:javascript|data:text\/html):/i, `${relative(htmlPath)} has an unsafe URL`)
      const resolved = new URL(rawReference, pageUrlForHtml(htmlPath))
      if (resolved.origin !== "https://jarrettwilliams.com") continue
      if (resolved.pathname.startsWith("/umami/")) continue
      assert.ok(existsSync(localFileForUrl(resolved)), `${relative(htmlPath)} references missing ${resolved.pathname}`)
    }
  }
})

test("every HTML page has one title, canonical link, and meta description", () => {
  for (const htmlPath of walk(distRoot, (file) => file.endsWith(".html"))) {
    const html = readFileSync(htmlPath, "utf8")
    const name = relative(htmlPath)
    assert.equal((html.match(/<title\b/gi) || []).length, 1, name)
    assert.equal((html.match(/rel="canonical"/gi) || []).length, 1, name)
    assert.match(html, /<meta name="description" content="[^"]+"/, name)
  }
})

test("feeds and sitemap are well formed and list the posts", () => {
  const feed = readFileSync(path.join(distRoot, "feed.xml"), "utf8")
  const sitemap = readFileSync(path.join(distRoot, "sitemap.xml"), "utf8")
  assertWellFormedXml(feed, "feed.xml", "feed")
  assertWellFormedXml(sitemap, "sitemap.xml", "urlset")
  const json = JSON.parse(readFileSync(path.join(distRoot, "feed.json"), "utf8"))
  assert.equal(json.items.length, postSlugs().length)
  assert.match(json.items[0].content_html, /<p>/)
  assert.match(feed, /hello-world/)
  assert.match(sitemap, /\/blog\/hello-world\//)
})

test("_headers keeps the strict content security policy", () => {
  const headers = readFileSync(path.join(distRoot, "_headers"), "utf8")
  assert.match(headers, /Content-Security-Policy:/)
  assert.match(headers, /default-src 'self'/)
  assert.match(headers, /script-src 'self'/)
  assert.match(headers, /style-src 'self'/)
  assert.match(headers, /object-src 'none'/)
  assert.doesNotMatch(headers, /unsafe-inline/)
})

test("markdown sanitation drops active content and unsafe URLs", () => {
  const script = sanitizeHtml('<script src="/evil.js"></script><p>kept</p>')
  assert.equal(script.includes("<script"), false)
  assert.match(script, /kept/)

  const click = sanitizeHtml('<p OnClick="alert(1)">click</p>')
  assert.doesNotMatch(click, /onclick/i)

  const link = sanitizeHtml('<a href="javascript:alert(1)">unsafe</a>')
  assert.doesNotMatch(link, /javascript:/i)

  const image = sanitizeHtml('<img src="javascript:alert(1)" alt="unsafe">')
  assert.doesNotMatch(image, /javascript:/i)

  const safe = sanitizeHtml(
    '<figure><img src="/assets/images/hero-circuit.svg" alt="Circuit" width="1200" height="680" loading="lazy"><figcaption>Diagram</figcaption></figure>',
  )
  assert.match(safe, /<figure>/)
  assert.match(safe, /src="\/assets\/images\/hero-circuit\.svg"/)
  assert.match(safe, /loading="lazy"/)
})
