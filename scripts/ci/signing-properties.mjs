// java.util.Properties.load(InputStream) uses ISO-8859-1, even on a UTF-8 runner.
// Escape UTF-16 code units so non-ASCII passwords reach Java unchanged.
export function serializeProperties(values) {
  const escape = value => String(value)
    .replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('\r', '\\r')
    .replaceAll('\t', '\\t').replaceAll('\f', '\\f')
    .replaceAll('=', '\\=').replaceAll(':', '\\:').replaceAll(' ', '\\ ')
    .replace(/[^\x20-\x7e]/g, unit => `\\u${unit.charCodeAt(0).toString(16).padStart(4, '0')}`);
  return Object.entries(values).map(([key, value]) => `${key}=${escape(value)}`).join('\n') + '\n';
}
