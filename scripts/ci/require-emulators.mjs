for (const name of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
  if (!process.env[name]) throw new Error(`${name} is required; integration tests must not skip in CI.`);
  if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(process.env[name])) throw new Error('CI integration tests must use local emulators.');
}
