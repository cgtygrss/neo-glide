import Foundation
import XcodeProj
import PathKit
let project = try XcodeProj(path: Path(CommandLine.arguments[1]))
guard let target = project.pbxproj.nativeTargets.first else { fatalError("Missing app target") }
// Version-only preparation leaves signing, capabilities and package pins intact.
if let flag = CommandLine.arguments.firstIndex(of: "--set-release"), CommandLine.arguments.count > flag + 2 {
 let version = CommandLine.arguments[flag + 1], build = CommandLine.arguments[flag + 2]
 guard version.range(of: #"^\d+\.\d+\.\d+$"#, options: .regularExpression) != nil,
       let number = Int(build), number > 0 else { fatalError("Expected a semantic version and positive build number") }
 for config in target.buildConfigurationList?.buildConfigurations ?? [] {
  config.buildSettings["MARKETING_VERSION"] = version
  config.buildSettings["CURRENT_PROJECT_VERSION"] = build
 }
 try project.write(path: Path(CommandLine.arguments[1]))
 print("Prepared iOS \(version) (\(build))")
 exit(0)
}
for config in target.buildConfigurationList?.buildConfigurations ?? [] { config.buildSettings["CODE_SIGN_ENTITLEMENTS"] = "App/App.entitlements" }
if let attributes = project.pbxproj.projects.first?.attributes["TargetAttributes"] as? [String: Any] {
 var next = attributes
 for (id, value) in attributes { if var item = value as? [String: Any] { var caps = item["SystemCapabilities"] as? [String: Any] ?? [:]; caps["com.apple.GameCenter"] = ["enabled": 1]; item["SystemCapabilities"] = caps; next[id] = item } }
 project.pbxproj.projects.first?.attributes["TargetAttributes"] = next
}
// GoogleSignIn 10.0.0 has an AppCheck constraint incompatible with Firebase 13.
// Pin the upstream compatibility fix until the next GoogleSignIn release.
if let google = project.pbxproj.projects.first?.remotePackages.first(where: { $0.repositoryURL == "https://github.com/google/GoogleSignIn-iOS" }) {
 google.versionRequirement = .revision("56d4ddc4aea182bd89a78b18f38c7512bf137cc0")
}
// Release preparation stays opt-in so account setup never resets a future build number.
if let flag = CommandLine.arguments.firstIndex(of: "--release-build"), CommandLine.arguments.count > flag + 1 {
 let build = CommandLine.arguments[flag + 1]
 guard Int(build) != nil else { fatalError("Release build must be numeric") }
 for config in target.buildConfigurationList?.buildConfigurations ?? [] {
  config.buildSettings["CURRENT_PROJECT_VERSION"] = build
  if config.name == "Release" {
   config.buildSettings["CODE_SIGN_STYLE"] = "Manual"
   config.buildSettings["CODE_SIGN_IDENTITY"] = "Apple Distribution"
   config.buildSettings["PROVISIONING_PROFILE_SPECIFIER"] = "Neo Glide App Store 2026"
  }
 }
 let sourceRoot = Path(CommandLine.arguments[1]).parent().absolute()
 guard let group = project.pbxproj.groups.first(where: { $0.path == "App" }),
       let resources = try target.resourcesBuildPhase() else { fatalError("Missing app resources group or phase") }
 let manifest = try group.addFile(at: sourceRoot + "App/PrivacyInfo.xcprivacy", sourceRoot: sourceRoot)
 _ = try resources.add(file: manifest)
}
try project.write(path: Path(CommandLine.arguments[1]))
