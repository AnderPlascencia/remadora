// Pasa un SVG a PNG con Playwright. Uso: node tools/brand/render.cjs rower-logo.svg rower-192.png:192 rower-512.png:512
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [, , svg, ...salidas] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage();
  const code = fs.readFileSync(svg, 'utf8');
  for (const s of salidas) {
    const [file, size] = s.split(':');
    await p.setViewportSize({ width: +size, height: +size });
    await p.setContent(`<html><body style="margin:0;background:transparent">${code.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await p.screenshot({ path: file, omitBackground: true });
  }
  await b.close();
})();
