# StoryWeave on Netlify (shared uploads)

Stories you upload are saved on the server (Netlify Blobs), so every visitor sees them.
The editor password is checked on the server and never appears in the page.

## Files
- `public/index.html` – the whole front-end
- `netlify/functions/stories.mjs` – the API (`/api/stories`, `/api/auth`)
- `netlify.toml`, `package.json` – build settings

## Deploy (GitHub)
1. Put this folder in a GitHub repository and push it.
2. In Netlify: Add new site > Import an existing project > pick the repo.
   Netlify reads `netlify.toml`, so leave the build settings as they are.
3. Site configuration > Environment variables > Add a variable:
   - Key: `DEV_PASSWORD`
   - Value: your editor password (use something stronger than `apple=67`)
4. Deploys > Trigger deploy > Deploy site. The variable only takes effect on a new deploy.

## Deploy (Netlify CLI, no GitHub)
```
npm install -g netlify-cli
cd storyweave-netlify
npm install
netlify login
netlify init            # or: netlify link (to reuse an existing site)
netlify env:set DEV_PASSWORD "your-password"
netlify deploy --prod
```
Drag-and-drop deploys are not suitable: the function needs `npm install`.

## Check it works
1. Open your site, click Developer Mode (bottom-left), enter the password.
2. Upload a story.
3. Open the site in a private window. The story should be there.

## Notes
- Run locally with `netlify dev` (put `DEV_PASSWORD=...` in a `.env` file).
- Cover image URLs work on Netlify. Use direct https image links.
- Reading progress, bookshelf and text size stay per-visitor, in their own browser.
- If you used the older version, stories saved in your own browser move to the
  server the first time you unlock Developer Mode in that same browser.
- Limits: 500,000 characters per story, 200 chapters.
