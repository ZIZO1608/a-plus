# Deploying to aplus-sy.com with Coolify

The site is a static folder served by nginx in a small Docker container (`Dockerfile`, `nginx.conf`, `security-headers.conf`).
Coolify builds it from a Git repository and handles HTTPS for the domain.

## 1. DNS (at the domain registrar)

| Type | Name  | Value           |
|------|-------|-----------------|
| A    | `@`   | your VPS IP     |
| A    | `www` | your VPS IP     |

If the domain is on Cloudflare, set both records to **DNS only** (grey cloud) for the first deploy so Let's Encrypt can issue the certificate.
You can turn the orange cloud on afterwards with SSL mode **Full (strict)**.

Check it has spread before deploying: `nslookup aplus-sy.com` should return the VPS IP.

## 2. Put the code on GitHub

Create a **private** repository (for example `aplus-menu`) and push this folder to it:

```
git init
git add .
git commit -m "A PLUS menu"
git branch -M main
git remote add origin https://github.com/<you>/aplus-menu.git
git push -u origin main
```

## 3. Create the app in Coolify

1. **Projects → (your project) → + New → Private Repository (with GitHub App)**. Connect GitHub if you haven't yet, then pick `aplus-menu`, branch `main`.
2. **Build Pack:** `Dockerfile`. **Base Directory:** `/`.
3. **Ports Exposes:** `80`.
4. **Domains:** `https://aplus-sy.com,https://www.aplus-sy.com`.
5. In **Advanced**, set the www redirect to **Redirect to non-www**, so everything ends up on `https://aplus-sy.com`.
6. **Health check:** path `/healthz`, port `80`. The container also has its own Docker health check.
7. Press **Deploy**. When it's done, open https://aplus-sy.com.

Turn on **Auto Deploy** so every `git push` updates the live site.

## 4. Check it

- https://aplus-sy.com: the menu, with a padlock in the address bar
- https://www.aplus-sy.com should redirect to the address without www
- https://aplus-sy.com/feedback: the complaints page
- https://aplus-sy.com/tables: QR table cards (already set to aplus-sy.com)
- https://aplus-sy.com/anything-wrong: the "empty cup" 404 page
- Paste https://aplus-sy.com into WhatsApp: a preview card with the logo should appear (WhatsApp caches previews, so the first try can take a minute)
- https://aplus-sy.com/healthz shows `ok`

## Updating the menu later

1. Change prices in `index.html`, or add photos with `admin.html` (on your computer, http://localhost:5500/admin.html).
2. If you edited prices by hand, bump `VERSION` in `sw.js` (the photo studio does this for you).
3. `git add . && git commit -m "update menu" && git push`. Coolify redeploys in about a minute.

## What's in the container

- `admin.html` and the `.md` files are left out of the image (`.dockerignore`). The photo studio only works on your computer anyway.
- Pages and `sw.js` are never cached long, so price changes show up right away. Photos and fonts are cached for a week.
- Gzip, `nosniff`, `X-Frame-Options`, `Referrer-Policy` and HSTS headers are on.
- Short links: `/feedback` → complaints page, `/tables` → QR cards, and `/complaints` works without `.html`.
