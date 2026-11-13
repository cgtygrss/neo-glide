import XCTest
final class Capture: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.cgtygrssgame.neonglide")
 func button(_ label: String) -> XCUIElement { app.buttons.matching(identifier: label).firstMatch }
 func tap(_ label: String) { let b=button(label); XCTAssertTrue(b.waitForExistence(timeout: 20), "Missing button \(label): \(app.debugDescription)"); let visible=b.frame.intersection(app.frame.insetBy(dx: 8, dy: 8)); if visible.isNull || visible.isEmpty { b.tap() } else { app.coordinate(withNormalizedOffset:CGVector(dx:0,dy:0)).withOffset(CGVector(dx:visible.midX,dy:visible.midY)).tap() } }
 func capture(_ name: String) { let attachment=XCTAttachment(screenshot: XCUIScreen.main.screenshot()); attachment.name="app-capture-"+name; attachment.lifetime = .keepAlways; add(attachment) }
 func testCaptureCurrentRelease() {
  continueAfterFailure=false
  XCUIDevice.shared.orientation = .landscapeLeft
  app.launch(); XCTAssertTrue(app.wait(for: .runningForeground, timeout: 30))
  XCTAssertTrue(button("Garage").waitForExistence(timeout:30), app.debugDescription)
  let isPhone=app.frame.width/app.frame.height > 1.7
  capture("01-home")
  tap("Garage"); tap("Cosmetics"); app.swipeUp()
  let skins:[(String,String)] = [
    ("mint_condition", "Mint Condition"),
    ("amber_signal", "Amber Signal"),
    ("copper_horizon", "Copper Horizon"),
    ("scarlet_comet", "Scarlet Comet"),
    ("lunar_silver", "Lunar Silver"),
    ("arctic_pulse", "Arctic Pulse"),
    ("ocean_depth", "Ocean Depth"),
    ("toxic_bloom", "Toxic Bloom"),
    ("cyber_current", "Cyber Current"),
    ("lavender_dream", "Lavender Dream"),
    ("desert_mirage", "Desert Mirage"),
    ("jade_drift", "Jade Drift"),
    ("saffron_sky", "Saffron Sky"),
    ("coral_reef", "Coral Reef"),
    ("rose_circuit", "Rose Circuit"),
    ("ruby_eclipse", "Ruby Eclipse"),
    ("glacier_blue", "Glacier Blue"),
    ("nebula_circuit", "Nebula Circuit"),
    ("midnight_gold", "Midnight Gold"),
    ("solar_forge", "Solar Forge"),
    ("ultraviolet", "Ultraviolet"),
    ("aurora_pathfinder", "Aurora Pathfinder"),
    ("pearl_comet", "Pearl Comet"),
    ("void_pilot", "Void Pilot"),
    ("cobalt_storm", "Cobalt Storm"),
    ("prism_voyager", "Prism Voyager")
  ]
  for (index,skin) in skins.enumerated() {
   if index>0 { tap("Next cosmetic") }
   let title=app.descendants(matching:.any).matching(NSPredicate(format:"label == %@",skin.1)).firstMatch
   XCTAssertTrue(title.waitForExistence(timeout:10), "Wrong skin \(skin.1): \(app.debugDescription)")
   if isPhone { capture("iap-cosmetic_"+skin.0) }
  }
  capture("03-cosmetics-prism")
  tap("Ships"); app.swipeUp()
  for _ in 0..<15 { tap("Next ship") }
  capture("02-ships")
  tap("Weapons"); app.swipeUp()
  for _ in 0..<15 { tap("Next weapon") }
  capture("04-weapons")
  tap("Galaxies"); app.swipeUp()
  for _ in 0..<23 { tap("Next galaxy") }
  capture("05-galaxies")
  if isPhone {
   tap("Store"); app.swipeUp()
   for index in 0..<30 {
    if index>0 { tap("Next product") }
    let group=app.descendants(matching:.any).matching(NSPredicate(format:"label MATCHES %@", "^[0-9]+ of 30: .+")).firstMatch
    print("STORE_CAPTURE|\(index+1)|\(group.exists ? group.label : "unknown")")
    capture(String(format:"store-%02d",index+1))
   }
  }
  tap("Back to home"); tap("Pilot career"); capture("06-pilot-career")
  tap("Account"); capture("07-pilot-account")
  tap("Back to home"); tap("Settings"); capture("08-settings"); tap("Close settings")
  tap("Play")
  if button("Boost — hold to rise").waitForExistence(timeout:12) {
   button("Boost — hold to rise").press(forDuration:1.5)
   capture("09-flight")
  } else {
   print("FLIGHT_CAPTURE_UNAVAILABLE|"+app.debugDescription)
  }
 }
}
