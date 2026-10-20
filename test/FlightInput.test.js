import test from "node:test";
import assert from "node:assert/strict";
import { FlightInput } from "../src/game/FlightInput.js";

test("a second touch releasing cannot interrupt a held boost", () => {
  const changes = [];
  const input = new FlightInput((active) => changes.push(active));
  input.press("pointer:1");
  input.release("pointer:2"); // FIRE releases independently.
  assert.deepEqual(changes, [true]);
  input.release("pointer:1");
  assert.deepEqual(changes, [true, false]);
});

test("mixed keyboard and pointer controls boost until the final source releases", () => {
  const changes = [];
  const input = new FlightInput((active) => changes.push(active));
  input.press("key:Space");
  input.press("pointer:3");
  input.press("key:Space");
  input.release("key:Space");
  assert.deepEqual(changes, [true]);
  input.release("pointer:3");
  assert.deepEqual(changes, [true, false]);
});

test("cancellation clears held controls so a new flight starts with fresh input", () => {
  const changes = [];
  const input = new FlightInput((active) => changes.push(active));
  input.press("pointer:1");
  input.press("key:ArrowUp");
  input.reset();
  input.release("pointer:1");
  input.press("pointer:2");
  input.release("pointer:2");
  assert.deepEqual(changes, [true, false, true, false]);
});
