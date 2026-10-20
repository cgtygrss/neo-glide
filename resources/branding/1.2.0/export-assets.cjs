// Format/size exports only. The original generated artwork is kept unchanged.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const dependency = createRequire(require.resolve('@capacitor/assets/package.json'));
const sharp = dependency('sharp');
const background = '#0b1725';
const input = path.join(__dirname, 'native-input');
const qa = path.join(__dirname, 'qa');

async function main() {
  await fs.mkdir(input, { recursive: true });
  await fs.mkdir(qa, { recursive: true });
  await fs.mkdir(path.join(root, 'public/icons'), { recursive: true });
  const icon = path.join(root, 'resources/icon.png');
  const splash = path.join(root, 'resources/splash.png');
  await sharp(path.join(__dirname, 'icon-source.png')).resize(1024, 1024).toColourspace('srgb').removeAlpha().png().toFile(icon);
  await sharp(path.join(__dirname, 'splash-source.png')).resize(2732, 2732).toColourspace('srgb').removeAlpha().png().toFile(splash);
  await fs.copyFile(icon, path.join(input, 'icon-only.png'));
  await fs.copyFile(icon, path.join(input, 'icon-foreground.png'));
  await sharp({ create: { width: 1024, height: 1024, channels: 3, background } }).png().toFile(path.join(input, 'icon-background.png'));
  await fs.copyFile(splash, path.join(input, 'splash.png'));
  await fs.copyFile(splash, path.join(input, 'splash-dark.png'));
  // Custom mode avoids replacing the authored splash with the icon artwork.
  const cli = path.join(path.dirname(require.resolve('@capacitor/assets/package.json')), 'bin/capacitor-assets');
  const generated = spawnSync(process.execPath, [cli, 'generate', '--ios', '--android', '--assetPath', path.relative(root, input), '--iconBackgroundColor', background, '--iconBackgroundColorDark', background, '--splashBackgroundColor', background, '--splashBackgroundColorDark', background], { cwd: root, stdio: 'inherit' });
  if (generated.status !== 0) throw new Error('Capacitor assets generation failed');
  for (const size of [192, 512]) await sharp(icon).resize(size, size).png().toFile(path.join(root, `public/icons/icon-${size}.png`));
  await sharp(icon).resize(64, 64).png().toFile(path.join(root, 'public/favicon.png'));
  await sharp(icon).resize(180, 180).png().toFile(path.join(root, 'public/apple-touch-icon.png'));
  // Match the LaunchScreen scaleAspectFill framing; these are QA crops, not store screenshots.
  for (const [name, width, height] of [['iphone-landscape', 2868, 1320], ['ipad-landscape', 2752, 2064], ['iphone-portrait', 1320, 2868]]) {
    await sharp(splash).resize(width, height, { fit: 'cover', position: 'centre' }).png().toFile(path.join(qa, `splash-${name}.png`));
  }
  for (const [file, size] of [[icon, 1024], [splash, 2732], [path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'), 1024]]) {
    const meta = await sharp(file).metadata();
    if (meta.width !== size || meta.height !== size || meta.hasAlpha) throw new Error(`Invalid opaque square export: ${file}`);
  }
  console.log('Opaque icon/splash exports, native assets, web icons and crop QA images generated.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
