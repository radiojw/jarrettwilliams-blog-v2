---
title: "Publishing a Static Site to Cloudflare Pages Without Making It a Whole Project"
date: "2026-04-28"
description: "A practical walkthrough for getting a simple static site onto Cloudflare Pages without turning deployment into a second job."
slug: "publishing-a-static-site-to-cloudflare-pages"
---

<p>I like static sites for the same reason I like simple admin scripts: fewer moving parts, fewer weird failures, and a much better chance that the thing still works a year from now when you have not thought about it once.</p>

<p>If all you need is a blog, a portfolio, a documentation site, or a lightweight company page, there is a good chance you do not need a full app server. You just need HTML, CSS, maybe a little JavaScript, and a place to publish it cleanly.</p>

<p>Cloudflare Pages is good for that.</p>

## What Cloudflare Pages is good at

<p>At the simple level, Cloudflare Pages gives you a place to host a folder full of built files and put a real domain on top of it. That means you can build locally, upload the output, and let Cloudflare handle the edge hosting, HTTPS, and the public-facing part.</p>

<p>The nice part is that it does not force you into a giant platform story. If your site builds into a <code>dist</code> folder, that is usually enough.</p>

## Why I prefer static for small content sites

<p>The main win is not speed, even though static sites are usually fast. The main win is operational calm.</p>

<p>There is no database to recover, no app process to babysit, no API endpoint to time out because one plugin decided to stop cooperating. When something breaks, the problem space is smaller.</p>

<p>That matters more than people admit.</p>

## The basic flow

<p>The publishing flow is usually this:</p>

1. Write or update the content.
2. Build the site into a static output folder.
3. Upload that folder to Cloudflare Pages.
4. Attach your domain.
5. Check the live site and make sure the obvious pages work.

<p>That is the whole shape of it. The details vary by project, but the idea stays small.</p>

## A simple example

<p>For a lightweight site generator, your build step may be nothing more than this:</p>

```bash
npm install
npm run build
```

<p>If your project is set up well, that leaves you with a folder like <code>dist</code> containing:</p>

```text
index.html
about/index.html
blog/index.html
assets/styles.css
```

<p>That output folder is the thing you care about. Everything before it is just preparation.</p>

## Where people usually make it harder than it needs to be

<p>A common mistake is trying to deploy the source project exactly like an app server project. That usually leads to extra setup, extra credentials, and extra ways to fail.</p>

<p>If the site is static, treat it like a static site. Build it once, publish the built files, and keep production as dumb as possible.</p>

<p>Another common mistake is assuming the domain problem is the site problem. A site can be built correctly and still look broken because DNS, proxying, or an old origin is still in the way.</p>

<p>When debugging, separate those layers in your head:</p>

1. Did the site build?
2. Did the built files deploy?
3. Does the domain point to the right place?
4. Is the browser showing a cached version?

<p>That order saves time.</p>

## The slightly technical part

<p>Cloudflare Pages works nicely when you have a clean output directory and a consistent deploy command. For direct upload, a command like this is the important bit:</p>

```bash
npx wrangler pages deploy dist --project-name your-project-name
```

<p>That command tells Cloudflare to take the already-built files in <code>dist</code> and publish them. You are not asking Cloudflare to guess how your project works. You are handing it the finished result.</p>

<p>That is usually the safer approach for small custom sites.</p>

## Domain cutover is where people get nervous

<p>Fair enough. That is the part where a site becomes real.</p>

<p>Once the Pages project is working on its own subdomain, the custom domain part is mostly a DNS exercise. Point the domain at the Pages project, wait for verification, and then confirm that the page you are loading is actually the new site.</p>

<p>If the old homepage still appears, do not immediately rewrite the site. Check whether the domain is still pointing at the previous host, or whether a stale cached response is what you are really looking at.</p>

## Why this setup tends to age well

<p>Years from now, I would rather open a repo and find simple content files, a small build script, and a predictable hosting target than try to remember why a tiny blog needed a full application stack.</p>

<p>That is really the case for this approach. It keeps the publishing pipeline understandable. It lowers the maintenance cost. It gives you fewer places to trip over your own tooling later.</p>

## Final thought

<p>If a website mostly exists to publish pages, make publishing pages the easy part.</p>

<p>Static output plus Cloudflare Pages is not the answer for everything, but for a straightforward blog or personal site, it is often the answer that stays out of your way.</p>
