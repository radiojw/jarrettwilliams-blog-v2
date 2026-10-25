function classNames(node) {
  const value = node?.properties?.className
  if (!value) return []
  return Array.isArray(value) ? value.map(String) : [String(value)]
}

function languageOf(pre) {
  const code = (pre.children || []).find((child) => child.type === "element" && child.tagName === "code")
  const langClass = classNames(code).find((name) => name.startsWith("language-"))
  return langClass ? langClass.slice("language-".length) : ""
}

function wrapCodeBlocks(node) {
  if (!node || typeof node !== "object" || !Array.isArray(node.children)) return

  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index]
    if (child?.type === "element" && child.tagName === "pre") {
      const lang = languageOf(child)
      if (!lang) continue
      node.children[index] = {
        type: "element",
        tagName: "div",
        properties: { className: ["code-block"] },
        children: [
          {
            type: "element",
            tagName: "span",
            properties: { className: ["code-lang"] },
            children: [{ type: "text", value: lang }],
          },
          child,
        ],
      }
      continue
    }
    wrapCodeBlocks(child)
  }
}

export function rehypeCodeLabel() {
  return (tree) => {
    wrapCodeBlocks(tree)
  }
}
