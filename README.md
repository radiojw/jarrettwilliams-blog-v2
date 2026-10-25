# jarrettwilliams.com

Editorial static site for [jarrettwilliams.com](https://jarrettwilliams.com). Astro builds the Markdown notes in `content/posts` into a static `dist/` folder.

## Commands

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # static files in dist/
npm run preview   # serve dist/
npm run new-post -- "Your Post Title"
npm test
```

`npm run build` is the production build. It writes the site to `dist/` (Astro's default output directory). The Caddy pull-deploy and the manual `rsync dist/` step in `.github/workflows/deploy.yml` still publish that same directory — the output path did not change when the custom `scripts/build.mjs` generator was replaced.

## Structure

- `content/posts` — Markdown notes. Frontmatter: `title`, `date`, `description`, `slug`, `tags` (comma-separated).
- `src/content.config.ts` — Astro content collection for those posts.
- `src/pages` — homepage, notes index, posts, tags, about, privacy, cookies, Atom/JSON feeds, sitemap.
- `src/styles/global.css` — editorial paper styles. Light is the default; a saved dark theme is an ink inversion.
- `public/` — fonts, images, favicon, theme/consent/search scripts, and `_headers`.
- `dist/` — generated site. Do not edit it by hand.

## Routes

| URL | Page |
| --- | --- |
| `/` | Editorial front page (Blog in the bottom nav) |
| `/blog/` | Notes index, with search |
| `/blog/<slug>/` | A note |
| `/tags/<tag>/` | Notes for one tag |
| `/about/` | About |
| `/feed.xml` | Atom feed |
| `/feed.json` | JSON Feed |
| `/sitemap.xml` | Sitemap |

The bottom nav is Blog, About, Notes, and RSS on every page. There is no primary top navigation bar.

## Deployment

Production is a static folder. `npm run build` must succeed before a deploy.

- Pushing to `main` runs `.github/workflows/deploy.yml`, which installs dependencies, runs `npm test`, and runs `npm run build`.
- The Caddy host pulls `dist/` into the site root. A manual dispatch of the same workflow can `rsync dist/` to `/srv/sites/jarrettwilliams.com/public/`.
- `_headers` in `dist/` still carries the content-security policy (`script-src 'self'`, `style-src 'self'`, no `unsafe-inline`). Pages, styles, and scripts are external files so that policy can stay strict. `/umami/script.js` is proxied by Caddy and is not part of `dist/`.

## Notes

- Node 22.23.4 or newer.
- New notes go in `content/posts`. `npm run new-post` writes the frontmatter the collection expects.
- Social cards are generated into `public/assets/images/` during dev and build and are gitignored.
