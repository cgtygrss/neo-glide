import Foundation
import Security

guard CommandLine.arguments.count == 2, let password = readLine(), !password.isEmpty else {
    fatalError("Pass an output path and a nonempty export password on stdin.")
}
let query: [String: Any] = [
    kSecClass as String: kSecClassIdentity,
    kSecMatchLimit as String: kSecMatchLimitAll,
    kSecReturnRef as String: true
]
var result: CFTypeRef?
guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
      let identities = result as? [SecIdentity] else { fatalError("No signing identities available.") }
let matches = identities.filter { identity in
    var certificate: SecCertificate?
    guard SecIdentityCopyCertificate(identity, &certificate) == errSecSuccess, let certificate else { return false }
    let name = SecCertificateCopySubjectSummary(certificate) as String? ?? ""
    return name.contains("Apple Distribution:") && name.contains("5NA3743WWP")
}
guard matches.count == 1 else { fatalError("Expected exactly one Neo Glide Apple Distribution identity.") }
var parameters = SecItemImportExportKeyParameters()
parameters.version = UInt32(SEC_KEY_IMPORT_EXPORT_PARAMS_VERSION)
parameters.passphrase = Unmanaged.passUnretained(password as CFString)
var exported: CFData?
let status = SecItemExport(matches[0], .formatPKCS12, [], &parameters, &exported)
guard status == errSecSuccess, let exported else { fatalError("Export denied or failed (\(status)).") }
let path = URL(fileURLWithPath: CommandLine.arguments[1])
try (exported as Data).write(to: path, options: .atomic)
try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: path.path)
print("Exported the selected distribution identity to an encrypted temporary file.")
