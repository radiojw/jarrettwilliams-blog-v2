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

Cloudflare Pages hosts the production site. Pushes to `main` build the site and deploy `dist` to the Pages project.

For a manual local build:

1. Run `npm run build`
2. Review the output in `dist`
3. Publish `dist` if you need an ad hoc deploy

## Notes

- This project does not need a Node app server in production
- The generated site includes `robots.txt`, `sitemap.xml`, `404.html`, and `feed.xml`
