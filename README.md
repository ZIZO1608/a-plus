# A PLUS Study Zone · Digital Menu

One file, no build step. Open `index.html` in a browser, or with Live Server in VS Code.

## Folder

```
aplus-menu/
├── index.html            the whole menu (HTML + CSS + JS)
├── complaints.html       complaints / suggestions / praise, sent on WhatsApp
├── tables.html           staff page: print a QR card for each table
├── logo.svg, logo.png    tab icon (drawn from the A+ mark; swap in your own if you like)
├── icon-512.png          phone home-screen icon
├── manifest.webmanifest  lets phones "Add to Home Screen" like an app
├── sw.js                 offline support
├── admin.html            photo studio, live at aplus-sy.com/admin
├── 404.html              "this cup is empty" page for wrong addresses
├── og.png                preview card shown when the link is shared
├── robots.txt, sitemap.xml
├── server.js, Dockerfile  the server (site + studio API) and its container (see DEPLOY.md)
├── images/               drink and snack photos (names below)
└── fonts/                Montserrat Arabic .woff2 files (names below)
```

## Running it

Offline mode and "Add to Home Screen" only work over http, not by double-clicking the file:

```
python -m http.server 5500
```

then open http://localhost:5500. The live site is https://aplus-sy.com, deployed with Coolify: see [DEPLOY.md](DEPLOY.md).

Share a single drink with `https://aplus-sy.com/?item=<id>` (the id is the first value in its `I(...)` line), or use the Share button in the drink's detail sheet.
The menu itself is `menu.json`; the page loads it on every visit, so changes show up right away.

## Menu studio (admin)

**Live:** open https://aplus-sy.com/admin on any phone or computer and log in with the studio password (`ADMIN_PASSWORD` in Coolify, see [DEPLOY.md](DEPLOY.md)). Every change is live on the menu immediately.

- **Edit an item:** tap it. Names and descriptions in English and Arabic, price, size, section, how it's served, caffeine, sweetness and the photo, with a live preview of the menu card (switch it between عربي and EN).
- **New item:** the gold "+ New item" button or the dashed card. Its photo is saved as `<id>.jpg`.
- **Sold out today:** the switch on each card. The menu greys the item out with "خلص اليوم" and it can't be ordered. Switch it back when it's in stock.
- **New / A+ signature / Coming soon:** switches in the editor. New shows a gold "جديد" badge.
- **Sections:** the "Sections" chip. Rename, reorder, change the icon, add, or delete empty ones.
- **History:** every save keeps the previous menu (the last 60). Restore any of them; the restore itself can be undone.
- **Photos:** drop one on a card, or many at once on the dashed box (matched by file name). The ring counts how many items have one.
- If two people edit at the same time, the second save is refused with a message instead of overwriting the first.

**On this computer:** `ADMIN_PASSWORD=pick-one DATA_DIR=./data node server.js` gives the same studio at http://localhost/admin. Or, with `python -m http.server`, open admin.html in Chrome or Edge and press "Choose folder" to edit `menu.json` and `images/` in this folder directly (no history in that mode).

## Table QR cards

Open `tables.html`, enter the address where the menu is online, pick the table range (and Wi-Fi if you want it printed), then press Print.
Each code opens `index.html?table=N`: the menu shows a "Table N" badge, and the WhatsApp order and the complaints form include the table number.

## Photos

Copy your existing `images/` folder in. The menu uses the same file names as your old site.
Until a photo exists, the card shows a drawn icon, so nothing breaks if one is missing.
Exact file names are in the `ITEMS` list in `index.html` (search for `/* ---------- DATA`).

## Arabic font (Montserrat Arabic)

English uses Montserrat from Google Fonts automatically.
Montserrat Arabic is not on Google Fonts, so put these files in `fonts/`:

```
MontserratArabic-Regular.woff2
MontserratArabic-Medium.woff2
MontserratArabic-SemiBold.woff2
MontserratArabic-Bold.woff2
MontserratArabic-ExtraBold.woff2
MontserratArabic-Black.woff2
```

If yours are `.ttf`, change `format("woff2")` to `format("truetype")` and the extensions in the `@font-face` lines at the top of the `<style>`.
Until the files are there, Arabic falls back to Tajawal.

## Editing the menu

Use the studio. Under the hood the menu is `menu.json`:

- `cats`: sections in order (`id`, `en`, `ar`, `icon`: one of coffee, warm, iced, mocktails, cold, energy, snacks, food).
- `items`: `id`, `c` (section id), `en`, `ar`, `de`/`da` (descriptions), `p` (price, `null` = coming soon), `caf` and `sug` (0 to 3), `t` (`h` hot, `i` iced, `c` chilled, `r` ready), `img` (file in `images/`), optional `sz`, and flags `sig`, `nw`, `soon`, `out`.
- `combos`: the study combos. `pair`: "goes well with" suggestions per section.

The `menu.json` in this repo is only the starting point. Once anyone saves in the live studio, the live copy lives in the server's data volume and editing the repo file no longer changes the site.

Caffeine and sweetness levels are estimates; check them with the café. WhatsApp number: search for `963969717279`.
## What's inside

- Loading screen with the logo.
- Scroll-through hero (the logo grows and you fly through the gold plus).
- Arabic / English switch (remembered on the device).
- Search, filters (hot, iced, no caffeine, A+ signature) and a sticky section bar.
- Item detail sheet with caffeine, sweetness, how it's served and pairings.
- "Find my drink" quiz.
- Order tray: + on any item, quantities, total, send on WhatsApp (remembered on the device).
- Study combos, back-to-top button, dark mode, reduced-motion support.
- Table-aware ordering from the QR cards, a bilingual feedback page, and offline / installable on phones.
