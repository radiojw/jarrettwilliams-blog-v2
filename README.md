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

This site is deployed automatically via **Cloudflare Pages Git integration**.

- Pushing to `main` triggers a new production build and deploy on Cloudflare (using `wrangler.toml`).
- The GitHub Action (`.github/workflows/deploy.yml`) validates the build on pull requests and can produce a `dist` artifact when run manually via **workflow_dispatch**.

For a manual local build:

1. Run `npm run build`
2. Review the output in `dist`
3. Publish `dist` if you need an ad hoc deploy (or use `npx wrangler pages deploy dist`)

## Notes

- This project does not need a Node app server in production.
- The generated site includes `robots.txt`, `sitemap.xml`, `404.html`, and `feed.xml`.
- Cloudflare Pages handles production builds/deploys on push to `main` via Git integration (see `wrangler.toml`).
