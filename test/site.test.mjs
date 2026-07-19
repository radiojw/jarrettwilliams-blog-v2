import assert from "node:assert/strict"
import { after, test } from "node:test"
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath, pathToFileURL } from "node:url"

const projectRoot = fileURLToPath(new URL("..", import.meta.url))
const buildScript = path.join(projectRoot, "scripts", "build.mjs")
const { renderInlineMarkdown, sanitizeHtml } = await import(pathToFileURL(buildScript))

const fixtureRoot = mkdtempSync(path.join(tmpdir(), "jarrettwilliams-blog-test-"))
cpSync(path.join(projectRoot, "content"), path.join(fixtureRoot, "content"), { recursive: true })
cpSync(path.join(projectRoot, "src"), path.join(fixtureRoot, "src"), { recursive: true })

const buildResult = spawnSync(process.execPath, [buildScript], {
  cwd: fixtureRoot,
  encoding: "utf8",
})
const distRoot = path.join(fixtureRoot, "dist")

after(() => {
  rmSync(fixtureRoot, { recursive: true, force: true })
})

function filesUnder(directory, predicate = () => true) {
  const files = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...filesUnder(entryPath, predicate))
    } else if (predicate(entryPath)) {
      files.push(entryPath)
    }
  }

  return files
}

function relativeToDist(filePath) {
  return path.relative(distRoot, filePath).split(path.sep).join("/")
}

function pageUrlForHtml(htmlPath) {
  const relativePath = relativeToDist(htmlPath)
  if (relativePath === "index.html") return "https://jarrettwilliams.com/"
  if (relativePath.endsWith("/index.html")) {
    return `https://jarrettwilliams.com/${relativePath.slice(0, -10)}`
  }
  return `https://jarrettwilliams.com/${relativePath}`
}

function localFileForUrl(url) {
  let pathname
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    assert.fail(`URL has invalid percent encoding: ${url.href}`)
  }

  const relativePath = pathname.replace(/^\/+/, "")
  if (pathname.endsWith("/")) {
    return path.join(distRoot, relativePath, "index.html")
  }
  return path.join(distRoot, relativePath)
}

function parseAttributes(tag) {
  const attributes = new Map()
  const attributePattern = /\b([a-z][a-z0-9:-]*)\s*=\s*(["'])(.*?)\2/gi
  for (const match of tag.matchAll(attributePattern)) {
    attributes.set(match[1].toLowerCase(), match[3])
  }
  return attributes
}

function normalizeUrlForSchemeCheck(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);?/gi, (_match, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_match, decimal) => String.fromCodePoint(parseInt(decimal, 10)))
    .replace(/&colon;/gi, ":")
    .replace(/&tab;|&newline;/gi, "")
    .replace(/&amp;/gi, "&")
    .replace(/[\u0000-\u0020]+/g, "")
    .toLowerCase()
}

function assertWellFormedXml(xml, filename, expectedRoot) {
  assert.match(xml, /^<\?xml\s+version=["']1\.0["'][^?]*\?>/i, `${filename} needs an XML declaration`)

  const withoutEntities = xml.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, "")
  assert.doesNotMatch(withoutEntities, /&/, `${filename} contains an unescaped ampersand`)

  const documentBody = xml
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim()
  const tagPattern = /<(\/?)\s*([a-z_][\w:.-]*)(?:\s+(?:[^<>\/"']+|"[^"]*"|'[^']*')*)?\s*(\/?)>/gi
  const stack = []
  const roots = []
  let match
  let previousEnd = 0

  while ((match = tagPattern.exec(documentBody))) {
    const betweenTags = documentBody.slice(previousEnd, match.index)
    assert.doesNotMatch(betweenTags, /[<>]/, `${filename} contains malformed markup near ${betweenTags}`)
    previousEnd = tagPattern.lastIndex

    const [, closing, tagName, selfClosing] = match
    if (closing) {
      assert.equal(selfClosing, "", `${filename} has an invalid closing tag`)
      assert.equal(stack.pop(), tagName, `${filename} has a mismatched </${tagName}> tag`)
    } else if (!selfClosing) {
      if (stack.length === 0) roots.push(tagName)
      stack.push(tagName)
    }
  }

  assert.doesNotMatch(documentBody.slice(previousEnd), /[<>]/, `${filename} has trailing malformed markup`)
  assert.deepEqual(stack, [], `${filename} has unclosed tags`)
  assert.deepEqual(roots, [expectedRoot], `${filename} must have one <${expectedRoot}> root`)
}

function parseHeaders(contents) {
  const sections = []
  let currentSection = null

  for (const [index, line] of contents.split(/\r?\n/).entries()) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue

    if (!/^\s/.test(line)) {
      currentSection = { pattern: line.trim(), headers: new Map() }
      sections.push(currentSection)
      continue
    }

    assert.ok(currentSection, `_headers line ${index + 1} appears before a path pattern`)
    const headerMatch = line.trim().match(/^([A-Za-z0-9-]+):\s*(.+)$/)
    assert.ok(headerMatch, `_headers line ${index + 1} is not a valid header`)
    assert.ok(!currentSection.headers.has(headerMatch[1].toLowerCase()), `_headers line ${index + 1} is duplicated`)
    currentSection.headers.set(headerMatch[1].toLowerCase(), headerMatch[2])
  }

  return sections
}

test("static build completes once in an isolated temporary workspace", () => {
  assert.equal(
    buildResult.status,
    0,
    `build failed\nstdout:\n${buildResult.stdout}\nstderr:\n${buildResult.stderr}`
  )
  assert.match(buildResult.stdout, /Built \d+ posts into /)
  assert.ok(existsSync(distRoot), "build did not create dist/")
})

test("sanitizeHtml neutralizes forbidden executable elements", () => {
  const corpus = [
    '<script src="/evil.js"></script><p>kept</p>',
    '<ScRiPt>alert(1)</sCrIpT>',
    '<iframe srcdoc="<script>alert(1)</script>">fallback</iframe>',
    '<object data="javascript:alert(1)"><embed src="data:text/html,<script>alert(1)</script>"></object>',
    '<embed src="https://example.com/plugin">',
  ]

  for (const input of corpus) {
    const output = sanitizeHtml(input)
    assert.doesNotMatch(output, /<(?:script|iframe|object|embed)\b/i, `unsafe element survived: ${input}`)
  }
  assert.equal(sanitizeHtml(corpus[0]), "<p>kept</p>")
})

test("sanitizeHtml removes event-handler attributes despite casing and whitespace", () => {
  const corpus = [
    '<p OnClick = "alert(1)">click</p>',
    '<img src="/safe.png" oNeRrOr\n =\t\'alert(1)\' alt="safe">',
    '<a href="https://example.com" ONMOUSEOVER\t= alert(1)>safe</a>',
    '<img src="/safe.png" onload=alert(1) alt="safe">',
  ]

  for (const input of corpus) {
    const output = sanitizeHtml(input)
    assert.doesNotMatch(output, /\son[a-z]+\s*=/i, `event handler survived: ${input}`)
  }
})

test("sanitizeHtml rejects scriptable anchor URL schemes and obfuscation", () => {
  const unsafeUrls = [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "javascript&#58;alert(1)",
    "jav&#x61;script&colon;alert(1)",
    "&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#58;alert(1)",
    "java&#x0a;script&#58;alert(1)",
    "java&Tab;script&colon;alert(1)",
    "java\nscript:alert(1)",
    "\tjava\rscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "data&#58;text/html,<img src=x onerror=alert(1)>",
  ]

  for (const url of unsafeUrls) {
    const output = sanitizeHtml(`<a href="${url}">unsafe</a>`)
    const anchorTag = output.match(/<a\b[^>]*>/i)?.[0] || ""
    const href = parseAttributes(anchorTag).get("href")
    if (href) {
      assert.doesNotMatch(
        normalizeUrlForSchemeCheck(href),
        /^(?:javascript|data:text\/html):/,
        `unsafe href survived: ${url}`
      )
    }
  }
})

test("sanitizeHtml enforces safe image sources", () => {
  const unsafeSources = [
    "javascript:alert(1)",
    "javascript&#58;alert(1)",
    "java\nscript:alert(1)",
    "data:text/html,<svg onload=alert(1)>",
    "data&#58;text/html,<script>alert(1)</script>",
  ]

  for (const src of unsafeSources) {
    const output = sanitizeHtml(`<img src="${src}" alt="unsafe">`)
    const imageTag = output.match(/<img\b[^>]*>/i)?.[0] || ""
    const renderedSrc = parseAttributes(imageTag).get("src")
    if (renderedSrc) {
      assert.doesNotMatch(
        normalizeUrlForSchemeCheck(renderedSrc),
        /^(?:javascript|data:text\/html):/,
        `unsafe image survived: ${src}`
      )
    }
  }

  assert.match(sanitizeHtml('<img src="/assets/safe.svg" alt="Safe">'), /^<img src="\/assets\/safe\.svg"/)
  assert.match(sanitizeHtml('<img src="https://example.com/safe.png" alt="Safe">'), /^<img src="https:\/\/example\.com\/safe\.png"/)
})

test("sanitizeHtml neutralizes mutation-XSS nesting and unclosed tags", () => {
  const mutationPayload = "<noscript><p title='</noscript><img src=x onerror=alert(1)>'>"
  const mutationOutput = sanitizeHtml(mutationPayload)
  assert.doesNotMatch(mutationOutput, /<(?:noscript|img)\b/i)
  assert.doesNotMatch(mutationOutput, /\sonerror\s*=/i)

  const unclosedCorpus = [
    "<script>alert(1)",
    '<img src="x" onerror="alert(1)"',
    '<iframe src="https://example.com"',
    '<a href="javascript:alert(1)">open',
  ]

  for (const input of unclosedCorpus) {
    const output = sanitizeHtml(input)
    assert.doesNotMatch(output, /<(?:script|iframe|img)\b/i, `unclosed active tag survived: ${input}`)
    assert.doesNotMatch(output, /javascript:/i, `scriptable URL survived: ${input}`)
  }
})

test("sanitizeHtml preserves legitimately allowed markup", () => {
  const safeMarkup = [
    "<p>Paragraph with <strong>bold</strong> and <em>emphasis</em>.</p>",
    "<h2>Heading</h2><h3>Subheading</h3>",
    "<ul><li>One</li></ul><ol><li>Two</li></ol>",
    "<blockquote><p>Quoted</p></blockquote>",
    "<pre><code>const safe = true</code></pre>",
    "<figure><img src=\"/assets/images/hero-circuit.svg\" alt=\"Circuit\" width=\"1200\" height=\"680\" loading=\"eager\"><figcaption>Diagram</figcaption></figure>",
    "<a href=\"https://example.com/docs\">External docs</a>",
    "<a href=\"/about/\">About</a>",
  ].join("")

  const output = sanitizeHtml(safeMarkup)
  for (const tag of ["p", "strong", "em", "h2", "h3", "ul", "ol", "li", "blockquote", "pre", "code", "figure", "img", "figcaption", "a"]) {
    assert.match(output, new RegExp(`<${tag}\\b`, "i"), `<${tag}> should survive`)
  }
  assert.match(output, /<a href="https:\/\/example\.com\/docs" rel="noopener noreferrer">/)
  assert.match(output, /<a href="\/about\/">/)
  assert.match(output, /width="1200" height="680" loading="eager" decoding="async"/)
})

test("renderInlineMarkdown escapes raw HTML and keeps safe inline formatting", () => {
  const output = renderInlineMarkdown(
    "Use **bold**, *emphasis*, `<tag>& $1`, and [docs](https://example.com/docs). <img src=x onerror=alert(1)>"
  )

  assert.match(output, /<strong>bold<\/strong>/)
  assert.match(output, /<em>emphasis<\/em>/)
  assert.match(output, /<code>&lt;tag&gt;&amp; \$1<\/code>/)
  assert.match(output, /<a href="https:\/\/example\.com\/docs" rel="noopener noreferrer">docs<\/a>/)
  assert.match(output, /&lt;img src=x onerror=alert\(1\)&gt;/)
  assert.doesNotMatch(output, /<img\b/i)
})

test("renderInlineMarkdown never turns unsafe Markdown links into anchors", () => {
  const corpus = [
    "[unsafe](javascript:alert(1))",
    "[unsafe](data:text/html,<script>alert(1)</script>)",
    "[unsafe](javascript&#58;alert(1))",
    "[unsafe](java%0ascript:alert(1))",
  ]

  for (const input of corpus) {
    assert.doesNotMatch(renderInlineMarkdown(input), /<a\b/i, `unsafe Markdown link rendered: ${input}`)
  }
})

test("every internal HTML href and src resolves inside dist", () => {
  const htmlFiles = filesUnder(distRoot, (filePath) => filePath.endsWith(".html"))
  assert.ok(htmlFiles.length > 0)

  for (const htmlPath of htmlFiles) {
    const html = readFileSync(htmlPath, "utf8")
    const attributePattern = /\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi

    for (const match of html.matchAll(attributePattern)) {
      const rawReference = match[2].replace(/&amp;/gi, "&")
      assert.doesNotMatch(rawReference, /^(?:javascript|data:text\/html):/i, `${relativeToDist(htmlPath)} has an unsafe URL`)

      const resolved = new URL(rawReference, pageUrlForHtml(htmlPath))
      if (resolved.origin !== "https://jarrettwilliams.com") continue

      const target = localFileForUrl(resolved)
      assert.ok(
        existsSync(target),
        `${relativeToDist(htmlPath)} references missing ${resolved.pathname} via ${match[2]}`
      )
    }
  }
})

test("feed.xml and sitemap.xml are structurally well-formed", () => {
  assertWellFormedXml(readFileSync(path.join(distRoot, "feed.xml"), "utf8"), "feed.xml", "feed")
  assertWellFormedXml(readFileSync(path.join(distRoot, "sitemap.xml"), "utf8"), "sitemap.xml", "urlset")
})

test("every HTML page has one title, canonical link, and meta description", () => {
  const htmlFiles = filesUnder(distRoot, (filePath) => filePath.endsWith(".html"))

  for (const htmlPath of htmlFiles) {
    const html = readFileSync(htmlPath, "utf8")
    const titleTags = html.match(/<title\b[^>]*>[\s\S]*?<\/title>/gi) || []
    const linkTags = html.match(/<link\b[^>]*>/gi) || []
    const metaTags = html.match(/<meta\b[^>]*>/gi) || []
    const canonicalLinks = linkTags.filter((tag) => {
      const rel = parseAttributes(tag).get("rel") || ""
      return rel.toLowerCase().split(/\s+/).includes("canonical")
    })
    const descriptions = metaTags.filter((tag) => parseAttributes(tag).get("name")?.toLowerCase() === "description")
    const pageName = relativeToDist(htmlPath)

    assert.equal(titleTags.length, 1, `${pageName} must have exactly one <title>`)
    assert.equal(canonicalLinks.length, 1, `${pageName} must have exactly one canonical link`)
    assert.equal(descriptions.length, 1, `${pageName} must have exactly one meta description`)
    assert.ok(parseAttributes(descriptions[0]).get("content")?.trim(), `${pageName} has an empty meta description`)
  }
})

test("every referenced /assets/ file exists", () => {
  const textFiles = filesUnder(distRoot, (filePath) => /\.(?:css|html|js|json|xml)$/.test(filePath))
  const references = new Set()

  for (const filePath of textFiles) {
    const contents = readFileSync(filePath, "utf8")
    for (const match of contents.matchAll(/\/assets\/[^"'<>\s)\\]+/g)) {
      references.add(match[0].replace(/[?#].*$/, ""))
    }
  }

  assert.ok(references.size > 0, "build output did not reference any assets")
  for (const reference of references) {
    assert.ok(existsSync(path.join(distRoot, reference)), `missing referenced asset ${reference}`)
  }
})

test("_headers parses and defines a content security policy", () => {
  const sections = parseHeaders(readFileSync(path.join(distRoot, "_headers"), "utf8"))
  assert.ok(sections.length > 0, "_headers has no path sections")

  const globalSection = sections.find((section) => section.pattern === "/*")
  assert.ok(globalSection, "_headers is missing the /* section")
  const csp = globalSection.headers.get("content-security-policy")
  assert.ok(csp, "_headers is missing Content-Security-Policy")
  assert.match(csp, /(?:^|;)\s*default-src 'self'(?:;|$)/)
  assert.match(csp, /(?:^|;)\s*object-src 'none'(?:;|$)/)
})
