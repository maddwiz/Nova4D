"use strict";

function parseInteger(value, fallback, min, max) {
  const parsed = parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function parseFloatSafe(value, fallback) {
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function inferClientId(req) {
  return req.query.client_id || req.get("X-Client-Id") || "cinema4d-live";
}

function toPublicProvider(provider) {
  return {
    kind: provider.kind,
    base_url: provider.base_url,
    model: provider.model,
    temperature: provider.temperature,
    max_tokens: provider.max_tokens,
    api_key_configured: Boolean(provider.api_key),
  };
}

module.exports = {
  parseInteger,
  parseFloatSafe,
  parseBoolean,
  inferClientId,
  toPublicProvider,
};
