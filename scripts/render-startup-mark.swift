import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// Export the shared menu/intro SVG into the existing iOS asset catalog.
// Native launch screens show the same faint mark as the first HTML/React frame.
final class Mark: NSObject, XMLParserDelegate {
    var elements: [(String, [String: String])] = []
    func parser(_ parser: XMLParser, didStartElement name: String, namespaceURI: String?, qualifiedName: String?, attributes: [String: String]) {
        if ["ellipse", "path", "circle"].contains(name) { elements.append((name, attributes)) }
    }
}
func number(_ attributes: [String: String], _ key: String) -> CGFloat { CGFloat(Double(attributes[key] ?? "0") ?? 0) }
func color(_ value: String?) -> CGColor {
    let hex = (value ?? "#000000").replacingOccurrences(of: "#", with: "")
    let rgb = UInt32(hex, radix: 16) ?? 0
    return CGColor(red: CGFloat((rgb >> 16) & 255) / 255, green: CGFloat((rgb >> 8) & 255) / 255, blue: CGFloat(rgb & 255) / 255, alpha: 1)
}
let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let source = root.appendingPathComponent("public/brand/neo-glide-mark.svg")
let parser = XMLParser(contentsOf: source)!
let mark = Mark(); parser.delegate = mark
guard parser.parse(), mark.elements.count == 3 else { fatalError("Invalid shared brand SVG") }
let assets = root.appendingPathComponent("ios/App/App/Assets.xcassets/Splash.imageset")
for scale in 1...3 {
    let width = 120 * scale, height = 97 * scale
    let ctx = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.translateBy(x: 0, y: CGFloat(height)); ctx.scaleBy(x: CGFloat(width) / 52, y: -CGFloat(height) / 42)
    ctx.setAlpha(0.18); ctx.beginTransparencyLayer(auxiliaryInfo: nil)
    for (kind, attributes) in mark.elements {
        ctx.saveGState()
        let path = CGMutablePath()
        if kind == "ellipse" {
            let cx = number(attributes, "cx"), cy = number(attributes, "cy")
            ctx.translateBy(x: cx, y: cy); ctx.rotate(by: -25 * .pi / 180); ctx.translateBy(x: -cx, y: -cy)
            path.addEllipse(in: CGRect(x: cx - number(attributes, "rx"), y: cy - number(attributes, "ry"), width: number(attributes, "rx") * 2, height: number(attributes, "ry") * 2))
        } else if kind == "circle" {
            let r = number(attributes, "r")
            path.addEllipse(in: CGRect(x: number(attributes, "cx") - r, y: number(attributes, "cy") - r, width: r * 2, height: r * 2))
        } else {
            let tokens = attributes["d"]!.replacingOccurrences(of: "M", with: " M ").replacingOccurrences(of: "L", with: " L ").replacingOccurrences(of: "Z", with: " Z ").split(whereSeparator: { $0.isWhitespace })
            var i = 0
            while i < tokens.count {
                let command = tokens[i]; i += 1
                if command == "Z" { path.closeSubpath(); continue }
                let point = CGPoint(x: Double(tokens[i])!, y: Double(tokens[i + 1])!); i += 2
                if command == "M" { path.move(to: point) } else { path.addLine(to: point) }
            }
        }
        if attributes["fill"] != "none" { ctx.addPath(path); ctx.setFillColor(color(attributes["fill"])); ctx.fillPath() }
        if let stroke = attributes["stroke"] { ctx.addPath(path); ctx.setStrokeColor(color(stroke)); ctx.setLineWidth(number(attributes, "stroke-width")); ctx.strokePath() }
        ctx.restoreGState()
    }
    ctx.endTransparencyLayer()
    let image = ctx.makeImage()!
    for suffix in ["", "-dark"] {
        let target = assets.appendingPathComponent("Default@\(scale)x~universal~anyany\(suffix).png")
        let destination = CGImageDestinationCreateWithURL(target as CFURL, UTType.png.identifier as CFString, 1, nil)!
        CGImageDestinationAddImage(destination, image, nil)
        guard CGImageDestinationFinalize(destination) else { fatalError("Cannot export \(target.path)") }
    }
}
// Legacy orientation/density PNGs otherwise override the new vector splash.
let resources = root.appendingPathComponent("android/app/src/main/res")
for directory in try FileManager.default.contentsOfDirectory(at: resources, includingPropertiesForKeys: nil) where directory.lastPathComponent.hasPrefix("drawable") {
    let old = directory.appendingPathComponent("splash.png")
    if FileManager.default.fileExists(atPath: old.path) { try FileManager.default.removeItem(at: old) }
}
print("Exported shared 1x/2x/3x launch marks; retired legacy Android splash bitmaps.")
