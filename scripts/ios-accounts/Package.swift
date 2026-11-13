// swift-tools-version: 6.0
import PackageDescription
let package = Package(name: "IOSAccounts", platforms: [.macOS(.v13)], dependencies: [.package(url: "https://github.com/tuist/XcodeProj.git", from: "8.27.7")], targets: [.executableTarget(name: "IOSAccounts", dependencies: [.product(name: "XcodeProj", package: "XcodeProj")], path: "Sources")])
