// Builds the favicon set and the share image (Open Graph / X card) from real data.
//
//   npm i --no-save puppeteer-core@23.11.1
//   node scripts/brand/make.mjs            # needs Google Chrome installed
//
// Writes public/favicon.svg, public/favicon-32.png, public/apple-touch-icon.png,
// public/favicon.ico and public/og-image.png (1200x630).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DATA = path.join(ROOT, 'public/data');
const OUT = path.join(ROOT, 'public');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Editorial palette (src/index.css)
const PAPER = '#faf7f0', INK = '#1d1b17', INK2 = '#5b574d', RED = '#c8102e', BLUE = '#3465a4';
const MID = [214, 208, 194], COLD = [52, 101, 164], HOT = [200, 16, 46];

// ---------- favicon: three hexagons, like a corner of the shot map ----------
const hex = (cx, cy, r) =>
  [...Array(6)].map((_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join('') + 'Z';
const s3 = Math.sqrt(3);
const R = 13;
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="12" fill="${PAPER}"/>
<path d="${hex(32 - (R * s3) / 2, 40, R - 1)}" fill="${BLUE}"/>
<path d="${hex(32 + (R * s3) / 2, 40, R - 1)}" fill="${RED}" opacity="0.55"/>
<path d="${hex(32, 40 - R * 1.5, R - 1)}" fill="${RED}"/>
</svg>`;
fs.writeFileSync(path.join(OUT, 'favicon.svg'), favicon);

// ---------- share image: Curry's career shot map ----------
const c = JSON.parse(fs.readFileSync(path.join(DATA, 'players/201939.json')));
const league = JSON.parse(fs.readFileSync(path.join(DATA, 'seasons.json'))).league;
const leaguePps = Object.values(league).reduce((a, l) => a + l.pointsPerShot, 0) / Object.keys(league).length;
const HX = 250, HY = 417.5, HR = 14;
const bins = new Map();
for (let i = 0; i < c.count; i++) {
  const px = HX + c.x[i], py = HY - c.y[i];
  const qf = ((s3 / 3) * px - py / 3) / HR, rf = ((2 / 3) * py) / HR, sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf); const s = Math.round(sf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
  const k = `${q},${r}`;
  let b = bins.get(k);
  if (!b) bins.set(k, (b = { x: HR * s3 * (q + r / 2), y: HR * 1.5 * r, n: 0, p: 0 }));
  b.n++;
  if (c.m[i]) b.p += c.v[i];
}
const all = [...bins.values()];
const cap = all.map(b => b.n).sort((a, b) => a - b)[Math.floor(all.length * 0.95)];
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const color = pps => {
  const t = Math.max(-1, Math.min(1, (pps - leaguePps) / 0.45));
  return `rgb(${(t < 0 ? mix(MID, COLD, -t) : mix(MID, HOT, t)).join(' ')})`;
};
const hexes = all
  .filter(b => b.y > 120)
  .map(b => `<path d="${hex(b.x, b.y, HR * (0.3 + 0.7 * Math.sqrt(Math.min(1, b.n / cap))))}" fill="${b.n < 8 ? 'rgb(207 201 187)' : color(b.p / b.n)}" opacity="${b.n < 8 ? 0.6 : 1}"/>`)
  .join('');
const court = `<svg viewBox="0 120 500 350" width="560" height="392" style="display:block;background:#f3efe6">
<g fill="none" stroke="#b9b2a2" stroke-width="2"><rect x="170" y="280" width="160" height="190"/><path d="M190 280A60 60 0 0 1 310 280"/>
<path d="M30 470L30 330A237.5 237.5 0 0 1 470 330L470 470"/><path d="M210 417.5A40 40 0 0 1 290 417.5"/><circle cx="250" cy="417.5" r="7.5"/>
<line x1="220" y1="430" x2="280" y2="430" stroke-width="4"/></g>${hexes}</svg>`;
const shots = c.count.toLocaleString('en-US');

const og = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;1,9..144,500&family=Inter:wght@500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:${PAPER};color:${INK};font-family:Inter,sans-serif;display:flex;padding:56px 0 0 64px;position:relative;overflow:hidden}
.l{width:470px;display:flex;flex-direction:column}
.brand{font:500 34px Fraunces,serif}.brand i{color:${RED}}
.rule{height:2px;background:${INK};margin:22px 0 26px}
.kicker{font:600 15px Inter;letter-spacing:.14em;color:${RED}}
h1{font:500 48px/1.1 Fraunces,serif;margin-top:12px;letter-spacing:-.01em}
.dek{font:500 19px/1.4 Inter;color:${INK2};margin-top:20px}
.url{position:absolute;left:64px;bottom:44px;font:600 18px Inter;color:${INK}}
.fig{position:absolute;right:52px;top:64px}
.cap{font:500 14px Inter;color:${INK2};margin-top:10px}
.key{display:flex;gap:6px;align-items:center;margin-top:6px;font:500 13px Inter;color:${INK2}}
.key span{display:inline-block;width:18px;height:10px}
</style></head><body>
<div class="l">
  <div class="brand">The Shot <i>Atlas</i></div>
  <div class="rule"></div>
  <div class="kicker">NBA · 2013-14 TO 2025-26</div>
  <h1>Where every player and team shoots from, and how well.</h1>
  <div class="dek">Shot maps, league comparisons and career trends for 1,693 players and all 30 teams.</div>
</div>
<div class="fig">${court}
  <div class="cap">Stephen Curry, every shot since 2013-14 (${shots})</div>
  <div class="key"><span style="background:rgb(${COLD.join(' ')})"></span><span style="background:rgb(${mix(MID, COLD, 0.5).join(' ')})"></span><span style="background:rgb(${MID.join(' ')})"></span><span style="background:rgb(${mix(MID, HOT, 0.5).join(' ')})"></span><span style="background:rgb(${HOT.join(' ')})"></span>&nbsp; points per shot vs the league</div>
</div>
<div class="url">theshotatlas.com</div>
</body></html>`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.setContent(og, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(OUT, 'og-image.png') });

const icon = async (size, file) => {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0">${favicon.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
  await page.screenshot({ path: path.join(OUT, file), omitBackground: true });
};
await icon(32, 'favicon-32.png');
await icon(180, 'apple-touch-icon.png');
await browser.close();

// favicon.ico: a single 32x32 PNG wrapped in an ICO header (supported by all current browsers).
const png = fs.readFileSync(path.join(OUT, 'favicon-32.png'));
const head = Buffer.alloc(22);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4);
head.writeUInt8(32, 6); head.writeUInt8(32, 7); head.writeUInt8(0, 8); head.writeUInt8(0, 9);
head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12); head.writeUInt32LE(png.length, 14); head.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(OUT, 'favicon.ico'), Buffer.concat([head, png]));
console.log('wrote favicon.svg, favicon-32.png, apple-touch-icon.png, favicon.ico, og-image.png');
