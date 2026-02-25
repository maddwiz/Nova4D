"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeVoiceText,
  trimVoicePrompt,
  stripVoiceCommandPrefix,
  parseVoiceShortcut,
} = require("../../server/ui/modules/voice_control");

test("normalizeVoiceText lowercases and collapses whitespace", () => {
  assert.equal(normalizeVoiceText("  Nova   COMMAND   Run   Cube "), "nova command run cube");
});

test("trimVoicePrompt removes leading punctuation", () => {
  assert.equal(trimVoicePrompt("... create a cube"), "create a cube");
});

test("stripVoiceCommandPrefix handles primary and fallback prefixes", () => {
  assert.equal(stripVoiceCommandPrefix("nova command run template"), "run template");
  assert.equal(stripVoiceCommandPrefix("nova run template"), "run template");
  assert.equal(stripVoiceCommandPrefix("hello world"), null);
});

test("parseVoiceShortcut returns smart-run action and prompt", () => {
  const parsed = parseVoiceShortcut("nova command smart run create a cube");
  assert.equal(parsed?.action, "smart-run");
  assert.equal(parsed?.prompt, "create a cube");
  assert.equal(parsed?.key, "smart-run|create a cube");
});

test("parseVoiceShortcut supports indexed history shortcuts", () => {
  const parsed = parseVoiceShortcut("nova command load history 3");
  assert.equal(parsed?.action, "load-history-session-index");
  assert.equal(parsed?.index, 3);
});

test("parseVoiceShortcut returns null for non-command transcript", () => {
  assert.equal(parseVoiceShortcut("build a redshift scene"), null);
});
