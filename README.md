# jarrettwilliams-blog-v2

Fresh static rebuild for `jarrettwilliams.com`.

## Commands

```bash
npm run build
npm run new-post -- "Your Post Title"
```

## Structure

- `content/posts` - markdown posts with frontmatter
- `scripts/build.mjs` - static site generator
- `src/styles.css` - site styles
- `dist` - generated output ready to publish

## Deployment

Build locally or on the server, then publish the contents of `dist` to the site root.

For a simple static deployment:

1. Run `npm run build`
2. Copy the contents of `dist` into `/httpdocs`
3. Remove any old app runtime files that should no longer be served

## Notes

- This project does not need a Node app server in production
- The generated site includes `robots.txt`, `sitemap.xml`, `404.html`, and `feed.xml`
