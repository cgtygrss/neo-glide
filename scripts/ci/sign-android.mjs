import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const directory = join(process.env.RUNNER_TEMP, 'neo-glide-signing');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const keystore = join(directory, 'upload.jks');
writeFileSync(keystore, Buffer.from(process.env.ANDROID_KEYSTORE_BASE64, 'base64'), { mode: 0o600 });
const escape = value => String(value).replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('\r', '\\r').replaceAll('=', '\\=').replaceAll(':', '\\:').replaceAll(' ', '\\ ');
const properties = { storeFile: keystore, storePassword: process.env.ANDROID_KEYSTORE_PASSWORD, keyAlias: process.env.ANDROID_KEY_ALIAS, keyPassword: process.env.ANDROID_KEY_PASSWORD };
writeFileSync('android/keystore.properties', Object.entries(properties).map(([key, value]) => `${key}=${escape(value)}`).join('\n') + '\n', { mode: 0o600 });
