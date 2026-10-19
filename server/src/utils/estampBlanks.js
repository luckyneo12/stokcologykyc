// Finds the printed DDPI blanks on a scanned e-stamp image:
//   "... executed by Mr./Mrs./Ms./M/s. ______________"   ← name blank
//   "____________________ on ____________ ."             ← left blank + date blank
// Scans differ in margins, size and tilt, so the blanks are located in each image instead of using fixed spots.
// Returns fractions of the image (x from the left, y from the top), or null when the stamp has no printed
// DDPI text (older blank stamps) or the image cannot be read — the caller then leaves the page as it is.

let canvasLib;
function getCanvasLib() {
  if (canvasLib === undefined) {
    try {
      canvasLib = require('@napi-rs/canvas'); // installed with pdfjs-dist
    } catch (e) {
      console.warn('[E-Stamp] Image reader not available, DDPI blanks will not be filled:', e.message);
      canvasLib = null;
    }
  }
  return canvasLib;
}

async function findDdpiBlanks(bytes) {
  const lib = getCanvasLib();
  if (!lib || !bytes) return null;
  const img = await lib.loadImage(Buffer.from(bytes));
  const W = 1400;
  const H = Math.round((img.height * W) / img.width);
  const canvas = lib.createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  const px = ctx.getImageData(0, 0, W, H).data;
  // The printed underscores are thin and light grey on these scans
  const dark = new Uint8Array(W * H);
  for (let i = 0, j = 0; j < W * H; i += 4, j++) {
    dark[j] = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114 < 200 ? 1 : 0;
  }
  const isDark = (x, y) => y > 0 && y < H && dark[y * W + x] === 1;

  // 1. Trace long horizontal lines in the lower part, away from the decorative borders. The tracer walks
  //    right and may step one row up or down, so a slightly tilted scan still gives one straight line.
  const xMin = Math.round(W * 0.08), xMax = Math.round(W * 0.9);
  const used = new Uint8Array(W * H);
  const lines = [];
  for (let y = Math.round(H * 0.5); y < Math.round(H * 0.95); y++) {
    for (let x = xMin; x < xMax; x++) {
      if (!isDark(x, y) || used[y * W + x]) continue;
      let cy = y, gap = 0, end = x, yLo = y, yHi = y;
      for (let nx = x + 1; nx < xMax; nx++) {
        let ny = -1;
        if (isDark(nx, cy)) ny = cy;
        else if (isDark(nx, cy + 1)) ny = cy + 1;
        else if (isDark(nx, cy - 1)) ny = cy - 1;
        if (ny < 0) { if (++gap > 3) break; continue; }
        gap = 0; cy = ny; end = nx;
        used[cy * W + nx] = 1;
        if (cy < yLo) yLo = cy;
        if (cy > yHi) yHi = cy;
      }
      const len = end - x;
      // straight enough to be a printed line, not a path through letters
      if (len >= W * 0.1 && yHi - yLo <= len * 0.05 + 4) {
        lines.push({ x0: x, x1: end, yStart: y, yEnd: cy, y: (y + cy) / 2, len });
      }
      x = end;
    }
  }
  // A printed line is a few pixels thick and gets traced more than once: keep one per line
  lines.sort((p, q) => q.len - p.len);
  const uniq = [];
  for (const l of lines) {
    if (!uniq.some(u => Math.abs(u.y - l.y) < 8 && l.x0 < u.x1 && l.x1 > u.x0)) uniq.push(l);
  }

  // 2. The "____ on ____" row: two long blanks side by side with a short gap (the word "on") between them,
  //    and the long name blank one text line above, starting to the right of the first blank
  for (const a of uniq) {
    if (a.len < W * 0.17) continue;
    for (const b of uniq) {
      if (b === a || b.len < W * 0.12 || b.x0 <= a.x1) continue;
      if (Math.abs(b.yStart - a.yEnd) > H * 0.006) continue;
      const gap = b.x0 - a.x1;
      if (gap < W * 0.015 || gap > W * 0.06) continue;
      const rowY = (a.yEnd + b.yStart) / 2;
      const name = uniq.find(l => l !== a && l !== b && l.len > W * 0.2
        && rowY - l.yStart > H * 0.01 && rowY - l.yStart < H * 0.03
        && l.x0 > a.x1 && l.x1 > b.x1 + W * 0.1);
      if (!name) continue;
      return {
        name: { x0: name.x0 / W, x1: name.x1 / W, y: name.yStart / H },
        date: { x0: b.x0 / W, x1: b.x1 / W, y: b.yStart / H },
        left: { x0: a.x0 / W, x1: a.x1 / W, y: a.yStart / H },
      };
    }
  }
  return null;
}

module.exports = { findDdpiBlanks };
