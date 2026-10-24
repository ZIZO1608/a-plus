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
After changing prices, bump `VERSION` in `sw.js` so phones that saved the menu offline get the new one.

## Adding photos (admin)

**Live:** open https://aplus-sy.com/admin on any phone or computer and log in with the studio password (`ADMIN_PASSWORD` in Coolify, see [DEPLOY.md](DEPLOY.md)). Saved photos show on the menu right away.

**On this computer:** `ADMIN_PASSWORD=pick-one DATA_DIR=./data node server.js` gives the same login screen at http://localhost/admin. Or, with `python -m http.server`, open admin.html in Chrome or Edge and press "Choose folder" to write straight into `images/`.

- Click or drop a photo on any item, drag and zoom it inside the arch, and press Save. It's stored with the exact name the menu expects.
- Drop or pick many photos at once: files are matched to items by name, so `iced latte.JPG` goes to Iced Latte.
- The ring shows how many items have a photo, and "Missing" lists the ones still to do.
- Photos are saved as 900×1080 JPEGs, small enough to load fast on phones.

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

Everything is in the `ITEMS` list inside the `<script>`. Each line is one item:

```
I('id', 'category', 'English name', 'Arabic name',
  'English description', 'Arabic description',
  price, caffeine 0-3, sweetness 0-3, 'h' hot | 'i' iced | 'c' chilled | 'r' ready,
  'photo-file.jpg', {sig:1 for A+ signature, soon:1 for coming soon, sz:'500 ml'})
```

- Change a price: edit the number.
- Coming soon: set the price to `null` and add `{soon:1}`.
- Caffeine and sweetness levels are estimates. Check them with the café.
- Iced Espresso is set to 130 (the old site said 13000).

Other things you may want to change:

- `COMBOS`: the three study combos.
- `PAIR`: "goes well with" suggestions per category.
- `CATS`: section names and order.
- WhatsApp number: search for `963969717279`.

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
