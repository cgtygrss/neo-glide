import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => readFileSync(resolve(root, file), 'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const native = JSON.parse(read('docs/legal/native-notices.json'));
native.entries = native.entries.map(entry => ({ ...entry, text: entry.text || native.texts[entry.textHash] }));
if (native.manual_review.length) throw new Error('Native licenses still need review.');
for (const [file, expected] of Object.entries(native.inputs || {})) {
  if (hash(readFileSync(resolve(root, file))) !== expected) throw new Error(`Refresh native notices after changing ${file}.`);
}
const apache = native.entries.find(entry => entry.component === 'Apache-licensed native components').text;
const entries = [];
const locked = JSON.parse(read('package-lock.json')).packages;

function sourceHeaders(directory, depth = 0) {
  if (depth > 4) return [];
  const notices = new Set();
  for (const file of readdirSync(directory, { withFileTypes: true })) {
    if (file.name === 'node_modules') continue;
    const path = join(directory, file.name);
    if (file.isDirectory()) {
      for (const notice of sourceHeaders(path, depth + 1)) notices.add(notice);
    } else if (/\.(m?js|ts)$/.test(file.name)) {
      const head = readFileSync(path, 'utf8').slice(0, 3500);
      for (const block of head.match(/\/\*[\s\S]*?\*\//g) || []) {
        if (/@license|copyright/i.test(block)) notices.add(block);
      }
    }
  }
  return [...notices];
}

for (const [location, record] of Object.entries(locked)) {
  if (!location || record.dev) continue;
  const directory = resolve(root, location);
  const packageInfo = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  const files = readdirSync(directory).filter(file => /^(licen[cs]e|notice|copying)([._-].*)?$/i.test(file));
  let text = files.map(file => `${file}\n\n${readFileSync(join(directory, file), 'utf8')}`).join('\n\n');
  if (!text && (packageInfo.name === 'firebase' || packageInfo.name.startsWith('@firebase/'))) {
    // Firebase's npm artifacts supply @license headers rather than root LICENSE.
    text = [...sourceHeaders(directory), apache].join('\n\n');
  }
  if (!text) throw new Error(`No license text for ${packageInfo.name}@${record.version}.`);
  entries.push({ component: packageInfo.name, version: record.version, source: `npm ${location}`, text });
}
// Tailwind's generated CSS is distributed with the game as well.
entries.push({ component: 'tailwindcss', version: JSON.parse(read('node_modules/tailwindcss/package.json')).version, source: 'npm tailwindcss/LICENSE', text: read('node_modules/tailwindcss/LICENSE') });
entries.push(...native.entries);
entries.push({ component: 'Music attribution', version: 'CC BY 4.0', source: 'public/audio/music/CREDITS.txt', text: read('public/audio/music/CREDITS.txt') });
entries.push({ component: 'Music license', version: 'CC BY 4.0', source: 'public/audio/music/CC-BY-4.0.txt', text: read('public/audio/music/CC-BY-4.0.txt') });

const groups = new Map();
for (const entry of entries) {
  const id = hash(entry.text);
  if (!groups.has(id)) groups.set(id, { text: entry.text, components: [] });
  groups.get(id).components.push({ component: entry.component, version: entry.version, source: entry.source });
}
const style = `body{margin:0;background:#0b1725;color:#e6f2f0;font:17px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:900px;margin:auto;padding:28px 22px 70px}a{color:#91e3ce;overflow-wrap:anywhere}h1{font-size:32px;line-height:1.2}h2{font-size:22px;margin-top:32px}nav{display:flex;gap:16px;flex-wrap:wrap;font-size:14px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.6 monospace;border:1px solid #44606c;padding:16px;border-radius:12px}li{margin:8px 0}.date{color:#a9c6ce}details{margin:12px 0}summary{cursor:pointer;padding:12px;border:1px solid #44606c;border-radius:10px}a:focus-visible,summary:focus-visible{outline:3px solid #ffe5a1;outline-offset:3px}`;
const page = (title, body) => `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${title} — Neo Glide</title><style>${style}</style></head><body><main><nav aria-label="Legal documents"><a href="privacy.html">Privacy</a><a href="support.html">Support &amp; parents</a><a href="delete-account.html">Delete account</a><a href="notices.html">Licenses</a></nav>${body}</main></body></html>\n`;
const familyPage = html => html.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '<span>$1</span>');
const outputs = ['public/legal', 'public/legal/family', 'developer-site/public'];
for (const directory of outputs) mkdirSync(resolve(root, directory), { recursive: true });
for (const document of ['privacy', 'support', 'delete-account']) {
  const html = page(document, read(`docs/legal/${document}.en.html`));
  writeFileSync(resolve(root, `public/legal/${document}.html`), html);
  writeFileSync(resolve(root, `public/legal/family/${document}.html`), familyPage(html));
  writeFileSync(resolve(root, `developer-site/public/${document}.html`), html);
}
const notices = page('Third-party licenses', `<h1>Third-party licenses and music credits</h1><p>Neo Glide includes components and integrations from the following projects. Their original rights and notices are retained independently of the game's own content. This inventory includes runtime dependencies and related platform integrations; not every listed module is active on every platform.</p><p>${entries.length} notice entries, grouped by identical license text. Music remains CC BY 4.0; no artist endorsement is implied.</p>${[...groups.values()].map(group => {
  const names = group.components.map(c => `${c.component} ${c.version}`);
  const title = names.slice(0, 3).join(' · ') + (names.length > 3 ? ` · ${names.length - 3} more components` : '');
  return `<details><summary>${escape(title)}</summary>${names.length > 3 ? `<ul>${names.map(name => `<li>${escape(name)}</li>`).join('')}</ul>` : ''}<pre>${escape(group.text)}</pre></details>`;
}).join('\n')}`);
writeFileSync(resolve(root, 'public/legal/notices.html'), notices);
writeFileSync(resolve(root, 'public/legal/family/notices.html'), familyPage(notices));
writeFileSync(resolve(root, 'developer-site/public/notices.html'), notices);
writeFileSync(resolve(root, 'public/legal/notices.json'), JSON.stringify({ format: 1, entries: entries.map(({ text, ...entry }) => ({ ...entry, textHash: hash(text) })), texts: Object.fromEntries([...groups].map(([id, group]) => [id, group.text])) }, null, 2) + '\n');
if (existsSync(resolve(root, 'developer-site/public/accessibility.html'))) copyFileSync(resolve(root, 'developer-site/public/accessibility.html'), resolve(root, 'public/legal/accessibility.html'));
console.log(`Packaged ${entries.length} software/music notice entries in ${groups.size} text groups, plus privacy/support/deletion pages.`);
