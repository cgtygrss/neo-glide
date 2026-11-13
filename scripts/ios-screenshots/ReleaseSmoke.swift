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
  a.name="release-smoke-"+name; a.lifetime = .keepAlways; add(a)
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
  XCTAssertTrue(app.staticTexts["NEO GLIDE · v1.2.2"].waitForExistence(timeout:5),app.debugDescription)
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
  boost.press(forDuration:0.4)
  capture("06-flight")
 }
}
