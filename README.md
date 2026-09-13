# FITSET — Deploy Instructions

## Folder structure (already set up for you)
```
fitset-deploy/
  index.html      ← your app, fetch call now points to /api/chat
  api/chat.js      ← serverless function, holds your API key safely
  package.json
```

## Steps

1. **Get an API key**
   Go to console.anthropic.com → API Keys → Create Key. Copy it.

2. **Install Vercel CLI** (one-time)
   ```
   npm i -g vercel
   vercel login
   ```

3. **Deploy from this folder**
   ```
   cd fitset-deploy
   vercel
   ```
   Follow the prompts (accept defaults — no framework, no build command needed).

4. **Add your API key**
   - Go to the project on vercel.com → Settings → Environment Variables
   - Add: `ANTHROPIC_API_KEY` = your real key
   - Redeploy so the function picks it up:
   ```
   vercel --prod
   ```

5. **Test it**
   Open the URL Vercel gives you, go to AI Coach, send a message.
   If something's wrong, check: Vercel dashboard → your project → Deployments → Functions → chat → Logs.

That's it — the browser never sees your key; it only talks to `/api/chat`, which talks to Anthropic on your behalf.
