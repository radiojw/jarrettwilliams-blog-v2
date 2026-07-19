// Dependency-free social-card rasterizer.
//
// The build imports createSocialCardPng() to create a crawler-compatible PNG
// for every post. Text uses a compact built-in bitmap face so generating cards
// needs only Node.js (no browser, native canvas package, or SVG renderer).

import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"
import { fileURLToPath } from "node:url"

const WIDTH = 1200
const HEIGHT = 630

const COLORS = {
  accent: [255, 180, 84],
  blue: [110, 168, 255],
  text: [243, 245, 250],
  secondary: [195, 201, 214],
  grid: [28, 32, 45],
}

// Five-by-seven bitmap glyphs. Cards deliberately use uppercase display text,
// which keeps the tiny renderer predictable while supporting authored ASCII.
const GLYPHS = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  6: ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00110", "00110"],
  ",": ["00000", "00000", "00000", "00000", "00110", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "'": ["00100", "00100", "00000", "00000", "00000", "00000", "00000"],
  ":": ["00000", "00100", "00100", "00000", "00100", "00100", "00000"],
  ";": ["00000", "00100", "00100", "00000", "00100", "00100", "01000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
}

function normalizeText(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\x7e]/g, "?")
    .toUpperCase()
}

function setPixel(pixels, x, y, color) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return
  const offset = (Math.floor(y) * WIDTH + Math.floor(x)) * 3
  pixels[offset] = color[0]
  pixels[offset + 1] = color[1]
  pixels[offset + 2] = color[2]
}

function drawRect(pixels, x, y, width, height, color) {
  const startX = Math.max(0, Math.floor(x))
  const startY = Math.max(0, Math.floor(y))
  const endX = Math.min(WIDTH, Math.ceil(x + width))
  const endY = Math.min(HEIGHT, Math.ceil(y + height))

  for (let py = startY; py < endY; py += 1) {
    for (let px = startX; px < endX; px += 1) {
      setPixel(pixels, px, py, color)
    }
  }
}

function drawCircleOutline(pixels, centerX, centerY, radius, thickness, color) {
  const innerSquared = (radius - thickness) ** 2
  const outerSquared = radius ** 2

  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      const distanceSquared = (x - centerX) ** 2 + (y - centerY) ** 2
      if (distanceSquared >= innerSquared && distanceSquared <= outerSquared) {
        setPixel(pixels, x, y, color)
      }
    }
  }
}

function measureText(value, scale) {
  const text = normalizeText(value)
  return text ? text.length * 6 * scale - scale : 0
}

function drawText(pixels, value, x, y, scale, color) {
  const text = normalizeText(value)
  let cursorX = x

  for (const character of text) {
    const glyph = GLYPHS[character] || GLYPHS["?"]
    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        if (glyph[row][column] === "1") {
          drawRect(pixels, cursorX + column * scale, y + row * scale, scale, scale, color)
        }
      }
    }
    cursorX += 6 * scale
  }
}

function wrapText(value, scale, maxWidth) {
  const words = normalizeText(value).trim().split(/\s+/).filter(Boolean)
  const lines = []
  let current = ""

  for (const sourceWord of words) {
    let word = sourceWord
    const maxCharacters = Math.max(1, Math.floor((maxWidth + scale) / (6 * scale)))

    while (measureText(word, scale) > maxWidth) {
      const piece = word.slice(0, maxCharacters)
      if (current) {
        lines.push(current)
        current = ""
      }
      lines.push(piece)
      word = word.slice(maxCharacters)
    }

    if (!word) continue
    const candidate = current ? `${current} ${word}` : word
    if (measureText(candidate, scale) <= maxWidth) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word
    }
  }

  if (current) lines.push(current)
  return lines
}

function layoutTitle(title) {
  const maxWidth = 1020
  const maxHeight = 292

  for (const scale of [8, 7, 6, 5, 4]) {
    const lines = wrapText(title, scale, maxWidth)
    const lineHeight = scale * 9
    if (lines.length * lineHeight <= maxHeight) {
      return { lines, scale, lineHeight }
    }
  }

  const scale = 4
  const lineHeight = scale * 9
  const maxLines = Math.floor(maxHeight / lineHeight)
  const lines = wrapText(title, scale, maxWidth).slice(0, maxLines)
  const lastIndex = lines.length - 1
  if (lastIndex >= 0) {
    const maxCharacters = Math.floor((maxWidth + scale) / (6 * scale))
    lines[lastIndex] = `${lines[lastIndex].slice(0, Math.max(1, maxCharacters - 3)).trimEnd()}...`
  }
  return { lines, scale, lineHeight }
}

function createBackground() {
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 3)

  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const gradient = (x / (WIDTH - 1) + y / (HEIGHT - 1)) / 2
      const dx = (x - 170) / 920
      const dy = (y - 10) / 700
      const glow = Math.max(0, 1 - dx * dx - dy * dy)
      setPixel(pixels, x, y, [
        Math.round(10 + gradient * 8 + glow * 9),
        Math.round(11 + gradient * 9 + glow * 16),
        Math.round(16 + gradient * 13 + glow * 31),
      ])
    }
  }

  for (let x = 48; x < WIDTH; x += 72) drawRect(pixels, x, 8, 1, HEIGHT - 8, COLORS.grid)
  for (let y = 62; y < HEIGHT; y += 72) drawRect(pixels, 0, y, WIDTH, 1, COLORS.grid)
  drawCircleOutline(pixels, 1084, 118, 86, 2, [42, 54, 78])
  drawCircleOutline(pixels, 1084, 118, 54, 2, [53, 69, 101])
  drawRect(pixels, 0, 0, WIDTH, 8, COLORS.accent)

  return pixels
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, "ascii")
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])))
  return Buffer.concat([length, typeBuffer, data, checksum])
}

function encodePng(pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(WIDTH, 0)
  header.writeUInt32BE(HEIGHT, 4)
  header[8] = 8 // bit depth
  header[9] = 2 // truecolor RGB

  const stride = WIDTH * 3
  const scanlines = Buffer.alloc((stride + 1) * HEIGHT)
  for (let y = 0; y < HEIGHT; y += 1) {
    const destination = y * (stride + 1)
    scanlines[destination] = 0 // PNG filter: None
    pixels.copy(scanlines, destination + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND"),
  ])
}

export function createSocialCardPng({
  title,
  kicker = "ARTICLE",
  footer = "IT OPERATIONS / SYSTEMS ENGINEERING / PRACTICAL NOTES",
} = {}) {
  const pixels = createBackground()
  drawText(pixels, "JARRETTWILLIAMS.COM", 90, 80, 4, COLORS.accent)
  drawText(pixels, kicker, 90, 151, 3, COLORS.blue)

  const { lines, scale, lineHeight } = layoutTitle(title || "Jarrett Williams")
  const titleTop = 201 + Math.max(0, (292 - lines.length * lineHeight) / 2)
  lines.forEach((line, index) => {
    drawText(pixels, line, 90, titleTop + index * lineHeight, scale, COLORS.text)
  })

  drawRect(pixels, 90, 530, 64, 4, COLORS.blue)
  drawText(pixels, footer, 90, 561, 3, COLORS.secondary)
  return encodePng(pixels)
}

export function writeSocialCard(outputPath, options) {
  const png = createSocialCardPng(options)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, png)
  return png.length
}

const modulePath = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  const rootDir = path.resolve(path.dirname(modulePath), "..")
  const outputPath = path.join(rootDir, "src", "images", "social-card.png")
  const bytes = writeSocialCard(outputPath, {
    title: "Jarrett Williams",
    kicker: "FIELD NOTES",
  })
  console.log(`Wrote ${outputPath} (${(bytes / 1024).toFixed(1)} KB)`)
}
