import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const distDir = path.join(repoRoot, 'dist');
const indexPath = path.join(distDir, 'index.html');

if (!fs.existsSync(indexPath)) {
  throw new Error(`Pages smoke test failed: missing ${indexPath}. Run the build first.`);
}

const html = fs.readFileSync(indexPath, 'utf8');

if (html.includes('https://fonts.googleapis.com') || html.includes('fonts.gstatic.com')) {
  throw new Error('Pages smoke test failed: built app still references external font hosts.');
}

if (html.includes('src="/assets/') || html.includes('href="/assets/')) {
  throw new Error('Pages smoke test failed: built assets still use absolute /assets/ paths.');
}

const assetMatches = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)];
if (!assetMatches.length) {
  throw new Error('Pages smoke test failed: built index.html does not reference relative ./assets paths.');
}

for (const [, relativeAssetPath] of assetMatches) {
  const absoluteAssetPath = path.join(distDir, relativeAssetPath);
  if (!fs.existsSync(absoluteAssetPath)) {
    throw new Error(`Pages smoke test failed: referenced asset does not exist: ${relativeAssetPath}`);
  }
}

console.log(`Pages smoke test passed with ${assetMatches.length} relative asset reference(s).`);
