# Deploying to aplus-sy.com with Coolify

The site runs as one small Node container (`Dockerfile` + `server.js`, no npm packages).
It serves the menu and the live menu studio at **https://aplus-sy.com/admin** (items, prices, sections, photos, sold out, history).
Coolify builds it from GitHub (`ZIZO1608/a-plus`, branch `main`) and handles HTTPS.

## Coolify settings

| Setting | Value |
|---|---|
| Build Pack | `Dockerfile` |
| Ports Exposes | `80` |
| Domains | `https://aplus-sy.com` and `https://www.aplus-sy.com` (port 80), redirect www → non-www |
| Health check | path `/healthz`, port `80` |

### Menu studio: two extra settings (required for /admin)

1. **Environment Variables → + Add**
   - Name: `ADMIN_PASSWORD`
   - Value: a long password only staff know (12+ characters)
   - Leave "Build Variable" **off**.
2. **Persistent Storage → + Add → Volume Mount**
   - Name: `aplus-photos`
   - Destination Path: `/data`

   This is where the live menu, its history and the uploaded photos are kept. Without it every change disappears on the next redeploy.
3. **Redeploy.**

Then open https://aplus-sy.com/admin, log in, and edit the menu. Changes show on the menu right away, with no git push needed.

To change the password, edit `ADMIN_PASSWORD` and redeploy (everyone gets logged out).

## DNS (Hostinger)

hPanel → Domains → aplus-sy.com → DNS / Nameservers → DNS records:

| Type | Name | Points to |
|---|---|---|
| A | `@` | the VPS IP |
| CNAME | `www` | `aplus-sy.com` |

Delete any `AAAA` record for `@`.

## Updating the menu

- **Everything on the menu** (items, prices, sections, sold out, photos): https://aplus-sy.com/admin, from any phone or computer. Live immediately, no deploy.
- **Code and design** (index.html, styles, server): edit, then `git push`. Coolify redeploys; the menu and photos in the volume are untouched.
- The repo's `menu.json` is only used until the first save in the studio. To start over from it, delete `/data/menu.json` in the volume (History still has every version).

## How it works

- `/menu.json` and `/images/<name>` are served from the volume first (`/data`), then from the repo.
- Every menu save is checked on the server (names, prices, sections, photo names, no HTML) and the previous version goes to `/data/history` (last 60 kept).
- The studio can only write photo names used by an item in the menu, only real JPEGs, up to 6 MB, and only after logging in.
- Login: 8 wrong tries from one address locks it for 15 minutes. Sessions last 12 hours (HttpOnly, SameSite=Strict, Secure cookie).
- Pages and photos are revalidated on each visit (fast 304 responses), so changes appear immediately. Text is gzipped.
- Short links: `/feedback`, `/tables`, `/admin`. Unknown addresses show the "empty cup" 404 page.
- Server logs (Coolify → Logs) show every saved/removed photo and every wrong password attempt.

## Checklist after deploying

- https://aplus-sy.com shows the menu with a padlock
- https://aplus-sy.com/healthz shows `ok`
- https://aplus-sy.com/admin shows "Staff login" (if it says "studio is locked", `ADMIN_PASSWORD` is missing)
- Upload one photo, then open the menu: it's there
- Redeploy, and the photo is still there (that means the volume is working)
