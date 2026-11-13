import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('delivered notices retain critical software copyrights and the complete music license', () => {
  const manifest = JSON.parse(read('public/legal/notices.json'));
  const text = Object.values(manifest.texts).join('\n');
  for (const packageName of ['react', 'react-dom', 'scheduler', 'lucide-react', '@capacitor/core', 'firebase']) {
    const entry = manifest.entries.find(item => item.component === packageName);
    assert.ok(entry, packageName);
    const license = manifest.texts[entry.textHash];
    assert.ok(license);
    assert.equal(createHash('sha256').update(license).digest('hex'), entry.textHash);
  }
  assert.match(text, /Meta Platforms, Inc/);
  assert.match(text, /Lucide Contributors/);
  assert.match(text, /Cole Bemis/);
  assert.match(text, /Drifty Co/);
  assert.ok(text.includes(read('public/audio/music/CC-BY-4.0.txt').trim()));
  assert.ok(manifest.entries.some(item => item.component.startsWith('Android / com.android.billingclient:billing')));
  assert.ok(manifest.entries.some(item => item.component === 'iOS SwiftPM / firebase-ios-sdk'));
});
test('family legal pages are self-contained and cannot open external destinations', () => {
  for (const name of ['privacy', 'support', 'delete-account', 'notices']) {
    const html = read(`public/legal/family/${name}.html`);
    assert.match(html, /<h1>/);
    assert.doesNotMatch(html, /<(?:script|form|iframe|img|object|embed|link)\b/i);
    assert.doesNotMatch(html, /\b(?:href|src|action)\s*=/i);
    assert.doesNotMatch(html, /url\s*\(/i);
  }
});
test('one policy source is packaged and published, and deletion works without installation', () => {
  assert.equal(read('public/legal/privacy.html'), read('developer-site/public/privacy.html'));
  assert.equal(read('public/legal/delete-account.html'), read('developer-site/public/delete-account.html'));
  const policy = read('public/legal/privacy.html');
  assert.match(policy, /Google Play payments/);
  assert.match(policy, /Under 18 and unknown-age/);
  const deletion = read('public/legal/delete-account.html');
  assert.match(deletion, /mailto:cgty5960@gmail.com\?subject=Neo%20Glide%20account%20deletion/);
  assert.match(deletion, /without installing/);
  assert.match(deletion, /ownership check/);
});
