import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { serializeProperties } from '../signing-properties.mjs';

test('the real Java Properties reader preserves Unicode and punctuation in signing passwords', () => {
  const directory = mkdtempSync(join(tmpdir(), 'neo-properties-'));
  const password = ' şifre:çığ=ö\\$ 🛰\t\n ';
  try {
    writeFileSync(join(directory, 'signing.properties'), serializeProperties({ password }));
    const source = join(directory, 'ReadProperties.java');
    writeFileSync(source, 'import java.util.*;import java.nio.file.*;import java.nio.charset.*;class ReadProperties {public static void main(String[] args)throws Exception {Properties p=new Properties();try(var in=Files.newInputStream(Path.of(args[0]))){p.load(in);}System.out.write(p.getProperty("password").getBytes(StandardCharsets.UTF_8));}}');
    const localJava = '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/java';
    const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin/java') : existsSync(localJava) ? localJava : 'java';
    const actual = execFileSync(java, [source, join(directory, 'signing.properties')], { encoding: 'utf8' });
    assert.equal(actual, password);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
