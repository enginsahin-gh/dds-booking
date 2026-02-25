#!/usr/bin/env node
/**
 * Generate SRI (Subresource Integrity) hashes for widget assets.
 * Run after build: node scripts/generate-sri.mjs
 */
import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const dist = join(process.cwd(), 'dist');
const files = ['widget.js', 'widget.css', 'embed.js'];

console.log('\n🔒 SRI Hashes (use in embed script tags):\n');

for (const file of files) {
  const path = join(dist, file);
  if (!existsSync(path)) {
    console.log(`  ⚠ ${file} — not found`);
    continue;
  }
  const content = readFileSync(path);
  const hash = createHash('sha384').update(content).digest('base64');
  const sri = `sha384-${hash}`;
  console.log(`  ${file}`);
  console.log(`    integrity="${sri}"\n`);
}

console.log('Example embed tag:');
console.log('  <script src="https://boeken.ensalabs.nl/embed.js" integrity="sha384-..." crossorigin="anonymous" data-salon="your-salon"></script>\n');
