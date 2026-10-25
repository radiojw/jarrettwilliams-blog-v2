import { defaultSchema } from "rehype-sanitize"

const attributes = defaultSchema.attributes || {}

// A bare "className" entry allows every class. It has to come before any
// tuple restriction, because hast-util-sanitize uses the first match.
export const sanitizeSchema = {
  ...defaultSchema,
  clobber: [],
  tagNames: [...(defaultSchema.tagNames || []), "figure", "figcaption"],
  attributes: {
    ...attributes,
    img: [...(attributes.img || []), "loading", "decoding"],
    span: ["className"],
    code: ["className"],
    pre: ["className"],
  },
}
