"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseIntOrFallback,
  parseFloatOrFallback,
} = require("../../server/ui/modules/workflow_engine");

test("parseIntOrFallback parses valid integers and falls back on invalid input", () => {
  assert.equal(parseIntOrFallback("42", 7), 42);
  assert.equal(parseIntOrFallback("15.8", 7), 15);
  assert.equal(parseIntOrFallback("not-a-number", 7), 7);
});

test("parseFloatOrFallback parses valid floats and falls back on invalid input", () => {
  assert.equal(parseFloatOrFallback("3.14", 1.5), 3.14);
  assert.equal(parseFloatOrFallback("10", 1.5), 10);
  assert.equal(parseFloatOrFallback("", 1.5), 1.5);
});
