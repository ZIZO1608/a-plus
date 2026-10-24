# Deploying to aplus-sy.com with Coolify

The site runs as one small Node container (`Dockerfile` + `server.js`, no npm packages).
It serves the menu and the live photo studio at **https://aplus-sy.com/admin**.
Coolify builds it from GitHub (`ZIZO1608/a-plus`, branch `main`) and handles HTTPS.

## Coolify settings

| Setting | Value |
|---|---|
| Build Pack | `Dockerfile` |
| Ports Exposes | `80` |
| Domains | `https://aplus-sy.com` and `https://www.aplus-sy.com` (port 80), redirect www → non-www |
| Health check | path `/healthz`, port `80` |

### Photo studio: two extra settings (required for /admin)

1. **Environment Variables → + Add**
   - Name: `ADMIN_PASSWORD`
   - Value: a long password only staff know (12+ characters)
   - Leave "Build Variable" **off**.
2. **Persistent Storage → + Add → Volume Mount**
   - Name: `aplus-photos`
   - Destination Path: `/data`

   This is where uploaded photos are kept. Without it they disappear on every redeploy.
3. **Redeploy.**

Then open https://aplus-sy.com/admin, log in, and add photos. They show on the menu right away, with no git push needed.

To change the password, edit `ADMIN_PASSWORD` and redeploy (everyone gets logged out).

## DNS (Hostinger)

hPanel → Domains → aplus-sy.com → DNS / Nameservers → DNS records:

| Type | Name | Points to |
|---|---|---|
| A | `@` | the VPS IP |
| CNAME | `www` | `aplus-sy.com` |

Delete any `AAAA` record for `@`.

## Updating the menu

- **Photos:** use https://aplus-sy.com/admin from any phone or computer.
- **Prices / items:** edit `index.html`, then `git add . && git commit -m "update menu" && git push`. Coolify redeploys (turn on Auto Deploy).
  Uploaded photos are not affected, because they live in the volume.

## How it works

- `/images/<name>` is served from the volume first (`/data/images`), then from the repo's `images/` folder.
- The studio can only write the exact photo names used in `index.html`, only real JPEGs, up to 6 MB, and only after logging in.
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
