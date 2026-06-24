const fs = require('fs');
const path = require('path');

const root = process.cwd();
const buildDir = path.join(root, 'build');

const indexVite = path.join(buildDir, 'index.vite.html');
const indexHtml = path.join(buildDir, 'index.html');
if (fs.existsSync(indexVite) && !fs.existsSync(indexHtml)) {
  fs.copyFileSync(indexVite, indexHtml);
}
if (fs.existsSync(indexVite)) {
  fs.copyFileSync(indexVite, indexHtml);
}

if (!fs.existsSync(indexHtml)) {
  console.error('postbuild: build/index.html missing — run vite build first');
  process.exit(1);
}

// VPS nginx uses root=/var/www/.../web and try_files → /react-app.html (not /build/).
fs.copyFileSync(indexHtml, path.join(root, 'react-app.html'));

const assetsSrc = path.join(buildDir, 'assets');
const assetsDest = path.join(root, 'assets');
if (fs.existsSync(assetsSrc)) {
  fs.rmSync(assetsDest, { recursive: true, force: true });
  fs.cpSync(assetsSrc, assetsDest, { recursive: true });
}

for (const file of ['manifest.json', 'favicon.ico', 'logo192.png', 'logo512.png', 'logo.png']) {
  const src = path.join(buildDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(root, file));
  }
}

console.log('postbuild: synced SPA to react-app.html and /assets for nginx web root');
