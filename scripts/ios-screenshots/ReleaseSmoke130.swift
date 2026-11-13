import XCTest

// External UI harness: installed native Release app, normal controls only.
final class Capture: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.cgtygrssgame.neonglide")
 func button(_ label:String)->XCUIElement { app.buttons.matching(identifier:label).firstMatch }
 func tap(_ label:String) {
  let b=button(label)
  XCTAssertTrue(b.waitForExistence(timeout:20),"Missing \(label): \(app.debugDescription)")
  b.tap()
 }
 func capture(_ name:String) {
  let a=XCTAttachment(screenshot:XCUIScreen.main.screenshot())
  a.name="release-130-"+name; a.lifetime = .keepAlways; add(a)
 }
 func testReleaseNavigationAndFlight() {
  continueAfterFailure=false
  XCUIDevice.shared.orientation = .landscapeLeft
  addUIInterruptionMonitor(withDescription:"Optional tracking consent") { alert in
   for name in ["Ask App Not to Track","Uygulama Beni Takip Etmesin"] {
    let deny=alert.buttons[name];if deny.exists {deny.tap();return true}
   }
   return false
  }
  app.launch()
  XCTAssertTrue(button("Play").waitForExistence(timeout:40),app.debugDescription)
  let system=XCUIApplication(bundleIdentifier:"com.apple.springboard")
  for name in ["Ask App Not to Track","Uygulama Beni Takip Etmesin"] {
   let deny=system.buttons[name];if deny.waitForExistence(timeout:2){deny.tap()}
  }
  capture("01-home")
  tap("Settings")
  XCTAssertTrue(app.staticTexts["NEO GLIDE · v1.3.0"].waitForExistence(timeout:5),app.debugDescription)
  capture("02-settings-version")
  tap("Close settings")
  tap("Garage");tap("Ships");tap("Next ship");capture("03-ships")
  tap("Galaxies");capture("04-galaxies")
  tap("Back to home");tap("Play")
  let boost=button("Boost — hold to rise")
  XCTAssertTrue(boost.waitForExistence(timeout:15),app.debugDescription)
  wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"enabled == true"),object:boost)],timeout:10)
  // READY remains frozen: verify pause/resume before a short live flight.
  tap("Pause flight")
  XCTAssertTrue(app.staticTexts["Flight paused"].waitForExistence(timeout:5),app.debugDescription)
  capture("05-pause")
  tap("Keep flying")
  wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"enabled == true"),object:boost)],timeout:10)
  // Resolve coordinates while frozen, then pause immediately after a real hold.
  // Re-querying buttons between these gestures introduces >1s XCTest idle waits.
  let boostPoint=boost.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5))
  let pausePoint=button("Pause flight").coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5))
  boostPoint.press(forDuration:0.6)
  pausePoint.tap()
  XCTAssertTrue(app.staticTexts["Flight paused"].waitForExistence(timeout:5), app.debugDescription)
  capture("06-live-flight-paused")
  XCUIDevice.shared.press(.home)
  app.activate()
  XCTAssertTrue(app.staticTexts["Flight paused"].waitForExistence(timeout:10), app.debugDescription)
  capture("07-background-preserves-pause")
  XCUIDevice.shared.orientation = .landscapeRight
  XCTAssertTrue(app.staticTexts["Flight paused"].waitForExistence(timeout:5), app.debugDescription)
  capture("08-rotation-preserves-pause")
 }
}
