// Separate namespaces in the named events database. Firestore references stay
// native, so transaction read/write conflicts and server rules are unchanged.
export function sandboxDatabase(db) {
 const prefix='testEnvironments/storeSandbox/';
 return {
  doc:path=>db.doc(prefix+path),collection:path=>db.collection(prefix+path),
  runTransaction:callback=>db.runTransaction(callback),
  bulkWriter:()=>db.bulkWriter(),recursiveDelete:ref=>db.recursiveDelete(ref)
 };
}
