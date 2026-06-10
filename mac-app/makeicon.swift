import Cocoa

// Renders the app icon (top view of the robot vacuum, with a story-nod sparkle)
// to a 1024x1024 PNG at the path given in argv[1].

let px = 1024
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px,
                           bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                           colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)

func rgb(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat) -> NSColor {
    NSColor(deviceRed: r, green: g, blue: b, alpha: 1)
}

// rounded-square background
let bg = NSBezierPath(roundedRect: NSRect(x: 100, y: 100, width: 824, height: 824), xRadius: 185, yRadius: 185)
NSGradient(colors: [rgb(0.18, 0.23, 0.36), rgb(0.08, 0.10, 0.17)])!.draw(in: bg, angle: -90)

// floor rug
rgb(0.42, 0.27, 0.36).setFill()
NSBezierPath(ovalIn: NSRect(x: 182, y: 182, width: 660, height: 660)).fill()

// robot body + top + button
rgb(0.20, 0.23, 0.29).setFill()
NSBezierPath(ovalIn: NSRect(x: 237, y: 237, width: 550, height: 550)).fill()
rgb(0.30, 0.34, 0.41).setFill()
NSBezierPath(ovalIn: NSRect(x: 292, y: 292, width: 440, height: 440)).fill()
rgb(0.42, 1.0, 0.76).setFill()
NSBezierPath(ovalIn: NSRect(x: 457, y: 457, width: 110, height: 110)).fill()

// eyes (front of the robot = top of the icon)
rgb(0.60, 0.87, 1.0).setFill()
for x: CGFloat in [424, 536] {
    NSBezierPath(ovalIn: NSRect(x: x, y: 678, width: 64, height: 64)).fill()
}

// gold sparkle (the secret ring!)
rgb(0.95, 0.82, 0.42).setFill()
let s = NSBezierPath()
let cx: CGFloat = 760, cy: CGFloat = 760, big: CGFloat = 80, small: CGFloat = 22
s.move(to: NSPoint(x: cx, y: cy + big))
s.curve(to: NSPoint(x: cx + big, y: cy), controlPoint1: NSPoint(x: cx + small, y: cy + small), controlPoint2: NSPoint(x: cx + small, y: cy + small))
s.curve(to: NSPoint(x: cx, y: cy - big), controlPoint1: NSPoint(x: cx + small, y: cy - small), controlPoint2: NSPoint(x: cx + small, y: cy - small))
s.curve(to: NSPoint(x: cx - big, y: cy), controlPoint1: NSPoint(x: cx - small, y: cy - small), controlPoint2: NSPoint(x: cx - small, y: cy - small))
s.curve(to: NSPoint(x: cx, y: cy + big), controlPoint1: NSPoint(x: cx - small, y: cy + small), controlPoint2: NSPoint(x: cx - small, y: cy + small))
s.close()
s.fill()

NSGraphicsContext.restoreGraphicsState()
let png = rep.representation(using: .png, properties: [:])!
try! png.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
print("icon written: \(CommandLine.arguments[1])")
