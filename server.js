/* A PLUS server: serves the site and the live photo studio (admin.html). No dependencies.
   Photos uploaded through the studio are stored in DATA_DIR/images (a Coolify volume), so they
   survive redeploys, and they take priority over photos bundled in the repo's images/ folder.

   Env: ADMIN_PASSWORD (studio is disabled without it) · PORT (80) · DATA_DIR (/data) · SITE_DIR (this folder) */
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const PORT = +process.env.PORT || 80;
const SITE = path.resolve(process.env.SITE_DIR || __dirname);
const UPLOADS = path.join(path.resolve(process.env.DATA_DIR || '/data'), 'images');
const PASSWORD = process.env.ADMIN_PASSWORD || '';
const MAX_PHOTO = 6 * 1024 * 1024;
const SESSION_MS = 12 * 3600e3;
const LOGIN_TRIES = 8, LOGIN_WINDOW = 15 * 60e3;

const TYPES = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json', '.webmanifest':'application/manifest+json', '.xml':'application/xml', '.txt':'text/plain; charset=utf-8',
  '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif',
  '.ico':'image/x-icon', '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf'};
const COMPRESSIBLE = /^(text\/|application\/(json|xml|manifest)|image\/svg)/;
const SHORT = {'/feedback':'/complaints.html', '/tables':'/tables.html', '/admin':'/admin.html'};
const HIDDEN = new Set(['/server.js', '/Dockerfile']);
const SECURITY = {'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'strict-origin-when-cross-origin', 'X-Frame-Options':'SAMEORIGIN',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()'};

/* the studio may only write the file names the menu actually uses */
const PHOTOS = (() => {
  const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  const a = html.indexOf('const CATS'), b = html.indexOf('const BY');
  const {ITEMS} = new Function(html.slice(a, b) + ';return {ITEMS};')();
  return new Set(ITEMS.map(it => it.img.replace(/^images\//, '')));
})();

/* ---------- static files ---------- */
async function statFile(file){
  try{ const s = await fsp.stat(file); return s.isFile() ? {file, size:s.size, mtimeMs:s.mtimeMs} : null; }catch(e){ return null; }
}
async function resolve(urlPath){
  /* collapse "/images/../server.js" before any checks, so the deny rules see the real target */
  urlPath = path.posix.normalize(urlPath.replace(/\\/g, '/'));
  urlPath = SHORT[urlPath.replace(/\/$/, '')] || urlPath;
  if(urlPath.endsWith('/')) urlPath += 'index.html';
  if(HIDDEN.has(urlPath) || /\.md$/i.test(urlPath) || urlPath.split('/').some(s => s.startsWith('.'))) return null;
  if(urlPath.startsWith('/images/')){
    const name = urlPath.slice(8);
    if(PHOTOS.has(name)){ const up = await statFile(path.join(UPLOADS, name)); if(up) return up; }
  }
  const file = path.join(SITE, urlPath);
  if(!file.startsWith(SITE + path.sep)) return null;
  return await statFile(file) || (!path.extname(file) && await statFile(file + '.html')) || null;
}
/* pages and photos revalidate every time (cheap 304s), so price and photo changes show up at once; fonts never change */
const cacheFor = ext => /^\.(woff2?|ttf)$/.test(ext) ? 'public, max-age=2592000, immutable' : 'no-cache';

const gzCache = new Map();
async function body(f, type, gzip){
  if(!gzip || !COMPRESSIBLE.test(type) || f.size < 512) return {buf: await fsp.readFile(f.file)};
  const hit = gzCache.get(f.file);
  if(hit && hit.mtimeMs === f.mtimeMs) return {buf: hit.buf, gz: true};
  const buf = zlib.gzipSync(await fsp.readFile(f.file), {level: 6});
  gzCache.set(f.file, {mtimeMs: f.mtimeMs, buf});
  return {buf, gz: true};
}
async function sendFile(req, res, f, status = 200){
  const ext = path.extname(f.file).toLowerCase(), type = TYPES[ext] || 'application/octet-stream';
  const etag = `W/"${f.size.toString(36)}-${Math.floor(f.mtimeMs).toString(36)}"`;
  const headers = {...SECURITY, ...hsts(req), 'Content-Type': type, 'Cache-Control': status === 200 ? cacheFor(ext) : 'no-cache',
    'ETag': etag, 'Last-Modified': new Date(f.mtimeMs).toUTCString(), 'Vary': 'Accept-Encoding'};
  if(path.basename(f.file) === 'sw.js') headers['Service-Worker-Allowed'] = '/';
  if(status === 200 && req.headers['if-none-match'] === etag){ res.writeHead(304, headers); return res.end(); }
  const {buf, gz} = await body(f, type, /\bgzip\b/.test(req.headers['accept-encoding'] || ''));
  if(gz) headers['Content-Encoding'] = 'gzip';
  headers['Content-Length'] = buf.length;
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : buf);
}
const https = req => req.headers['x-forwarded-proto'] === 'https';
const hsts = req => https(req) ? {'Strict-Transport-Security': 'max-age=31536000'} : {};

/* ---------- studio API ---------- */
const sessions = new Map();   /* token -> expiry; in memory, so a redeploy just asks for the password again */
const attempts = new Map();   /* ip -> {n, since} */
const clientIp = req => req.headers['x-real-ip'] || req.socket.remoteAddress || '';
const cookie = (req, name) => (req.headers.cookie || '').split(/;\s*/).map(c => c.split('=')).find(([k]) => k === name)?.[1];
const authed = req => { const t = cookie(req, 'aplus_admin'), exp = t && sessions.get(t); return !!exp && exp > Date.now(); };
const hash = s => crypto.createHash('sha256').update(String(s)).digest();
const json = (req, res, status, data, extra = {}) => {
  const buf = Buffer.from(JSON.stringify(data));
  res.writeHead(status, {...SECURITY, ...hsts(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Content-Length': buf.length, ...extra});
  res.end(buf);
};
function readBody(req, limit){
  return new Promise((ok, fail) => {
    let chunks = [], size = 0, done = false;
    const stop = err => { if(!done){ done = true; chunks = []; fail(err); } };
    /* past the limit keep draining (and discarding) so the client gets a proper 413 instead of a reset */
    req.on('data', c => { if(done) return; size += c.length; if(size > limit) stop(Object.assign(new Error('too large'), {status: 413})); else chunks.push(c); });
    req.on('end', () => { if(!done){ done = true; ok(Buffer.concat(chunks)); } });
    req.on('error', stop);
    req.on('close', () => stop(new Error('aborted')));
  });
}
/* cookies are SameSite=Strict already; this also refuses writes posted from another site */
const sameOrigin = req => { const o = req.headers.origin; try{ return !o || new URL(o).host === req.headers.host; }catch(e){ return false; } };

async function api(req, res, url){
  const route = url.pathname.slice(5), method = req.method;
  if(method !== 'GET' && !sameOrigin(req)) return json(req, res, 403, {error: 'Wrong origin'});

  if(route === 'session' && method === 'GET') return json(req, res, 200, {enabled: !!PASSWORD, authed: authed(req)});

  if(route === 'login' && method === 'POST'){
    if(!PASSWORD) return json(req, res, 503, {error: 'ADMIN_PASSWORD is not set on the server.'});
    const ip = clientIp(req), a = attempts.get(ip);
    if(a && Date.now() - a.since < LOGIN_WINDOW && a.n >= LOGIN_TRIES) return json(req, res, 429, {error: 'Too many tries. Wait 15 minutes.'});
    let pw = '';
    try{ pw = JSON.parse(await readBody(req, 2048)).password || ''; }catch(e){ return json(req, res, 400, {error: 'Bad request'}); }
    if(!crypto.timingSafeEqual(hash(pw), hash(PASSWORD))){
      attempts.set(ip, a && Date.now() - a.since < LOGIN_WINDOW ? {n: a.n + 1, since: a.since} : {n: 1, since: Date.now()});
      console.warn(`[studio] wrong password from ${ip}`);
      return json(req, res, 401, {error: 'Wrong password.'});
    }
    attempts.delete(ip);
    const token = crypto.randomBytes(32).toString('base64url');
    sessions.set(token, Date.now() + SESSION_MS);
    return json(req, res, 200, {ok: true}, {'Set-Cookie': `aplus_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}${https(req) ? '; Secure' : ''}`});
  }

  if(route === 'logout' && method === 'POST'){
    sessions.delete(cookie(req, 'aplus_admin'));
    return json(req, res, 200, {ok: true}, {'Set-Cookie': 'aplus_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
  }

  if(!authed(req)) return json(req, res, 401, {error: 'Log in first.'});

  if(route === 'photos' && method === 'GET'){
    const photos = {};
    for(const name of PHOTOS){
      const f = await statFile(path.join(UPLOADS, name)) || await statFile(path.join(SITE, 'images', name));
      if(f) photos[name] = {v: Math.floor(f.mtimeMs), bundled: !f.file.startsWith(UPLOADS)};
    }
    return json(req, res, 200, {photos});
  }

  const m = route.match(/^photos\/(.+)$/);
  if(m){
    let name; try{ name = decodeURIComponent(m[1]); }catch(e){ return json(req, res, 400, {error: 'Bad name'}); }
    if(!PHOTOS.has(name)) return json(req, res, 404, {error: 'No menu item uses that photo name.'});
    const dest = path.join(UPLOADS, name);
    if(method === 'PUT'){
      if(!/^image\/jpeg\b/.test(req.headers['content-type'] || '')) return json(req, res, 415, {error: 'Send a JPEG.'});
      let buf;
      try{ buf = await readBody(req, MAX_PHOTO); }catch(e){ return json(req, res, e.status || 400, {error: e.status === 413 ? 'Photo is too large.' : 'Upload failed.'}); }
      if(buf.length < 3 || buf[0] !== 0xFF || buf[1] !== 0xD8 || buf[2] !== 0xFF) return json(req, res, 415, {error: 'That is not a JPEG.'});
      const tmp = `${dest}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      await fsp.writeFile(tmp, buf);
      await fsp.rename(tmp, dest);
      console.log(`[studio] saved ${name} (${Math.round(buf.length / 1024)} KB)`);
      return json(req, res, 200, {ok: true, v: Math.floor((await fsp.stat(dest)).mtimeMs)});
    }
    if(method === 'DELETE'){
      await fsp.rm(dest, {force: true});
      console.log(`[studio] removed ${name}`);
      return json(req, res, 200, {ok: true, bundled: !!await statFile(path.join(SITE, 'images', name))});
    }
  }
  return json(req, res, 404, {error: 'Not found'});
}

/* ---------- router ---------- */
const server = http.createServer(async (req, res) => {
  try{
    const url = new URL(req.url, 'http://x');
    if(url.pathname === '/healthz'){ res.writeHead(200, {'Content-Type': 'text/plain'}); return res.end('ok\n'); }
    if(url.pathname.startsWith('/api/')) return await api(req, res, url);
    if(req.method !== 'GET' && req.method !== 'HEAD'){ res.writeHead(405, {Allow: 'GET, HEAD'}); return res.end(); }
    let p; try{ p = decodeURIComponent(url.pathname); }catch(e){ res.writeHead(400); return res.end(); }
    const f = await resolve(p);
    if(f) return await sendFile(req, res, f);
    const nf = await statFile(path.join(SITE, '404.html'));
    if(nf) return await sendFile(req, res, nf, 404);
    res.writeHead(404); res.end();
  }catch(e){
    console.error(e);
    if(!res.headersSent){ res.writeHead(500); res.end(); }
  }
});

setInterval(() => {
  const now = Date.now();
  for(const [t, exp] of sessions) if(exp < now) sessions.delete(t);
  for(const [ip, a] of attempts) if(now - a.since > LOGIN_WINDOW) attempts.delete(ip);
}, 10 * 60e3).unref();

fs.mkdirSync(UPLOADS, {recursive: true});
fs.access(UPLOADS, fs.constants.W_OK, e => e && console.error(`[studio] cannot write to ${UPLOADS}. Mount a volume at ${path.dirname(UPLOADS)} (see DEPLOY.md).`));
if(!PASSWORD) console.warn('[studio] ADMIN_PASSWORD is not set, so /admin is locked. Set it in Coolify > Environment Variables.');
server.listen(PORT, () => console.log(`A PLUS on :${PORT} · site ${SITE} · photos ${UPLOADS} · ${PHOTOS.size} menu photos`));
