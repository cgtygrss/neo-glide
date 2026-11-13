import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serializeProperties } from './signing-properties.mjs';
const directory = join(process.env.RUNNER_TEMP, 'neo-glide-signing');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const keystore = join(directory, 'upload.jks');
writeFileSync(keystore, Buffer.from(process.env.ANDROID_KEYSTORE_BASE64, 'base64'), { mode: 0o600 });
const properties = { storeFile: keystore, storePassword: process.env.ANDROID_KEYSTORE_PASSWORD, keyAlias: process.env.ANDROID_KEY_ALIAS, keyPassword: process.env.ANDROID_KEY_PASSWORD };
writeFileSync('android/keystore.properties', serializeProperties(properties), { mode: 0o600 });
