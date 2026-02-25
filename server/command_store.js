"use strict";

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

let sqliteLoadAttempted = false;
let DatabaseSyncCtor = null;

function resolveDatabaseSync() {
  if (!sqliteLoadAttempted) {
    sqliteLoadAttempted = true;
    try {
      ({ DatabaseSync: DatabaseSyncCtor } = require("node:sqlite"));
    } catch (_err) {
      DatabaseSyncCtor = null;
    }
  }
  return DatabaseSyncCtor;
}

class CommandStore {
  constructor(options = {}) {
    this.leaseMs = Number.isFinite(options.leaseMs) ? options.leaseMs : 120000;
    this.maxRetention = Number.isFinite(options.maxRetention) ? options.maxRetention : 10000;
    this.persistDriver = String(options.persistDriver || "json").trim().toLowerCase() === "sqlite"
      ? "sqlite"
      : "json";
    this.persistPath = typeof options.persistPath === "string" && options.persistPath.trim()
      ? options.persistPath.trim()
      : "";
    this.sqlitePath = typeof options.sqlitePath === "string" && options.sqlitePath.trim()
      ? options.sqlitePath.trim()
      : "";
    this.persistDebounceMs = Number.isFinite(options.persistDebounceMs)
      ? Math.max(20, Math.min(5000, Math.floor(options.persistDebounceMs)))
      : 200;
    this.persistTimer = null;
    this.sqliteDb = null;
    this.sqliteEnabled = false;
    this.commands = new Map();
    this.pending = [];
    this.sseClients = new Map();
    this.stats = {
      queued_total: 0,
      dispatched_total: 0,
      succeeded_total: 0,
      failed_total: 0,
      canceled_total: 0,
      requeued_total: 0,
    };
    this._initPersistence();
    this._loadFromDisk();
  }

  enqueue(commandInput) {
    const now = Date.now();
    const command = {
      id: randomUUID(),
      route: commandInput.route,
      category: commandInput.category || "generic",
      action: commandInput.action || "command",
      payload: commandInput.payload || {},
      priority: Number.isFinite(commandInput.priority) ? commandInput.priority : 0,
      metadata: commandInput.metadata || {},
      status: "queued",
      attempts: 0,
      created_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
      dispatched_at: null,
      lease_expires_at: null,
      completed_at: null,
      delivered_to: null,
      result: null,
      error: null,
    };

    this.commands.set(command.id, command);
    this.pending.push(command.id);
    this._sortPending();
    this.stats.queued_total += 1;
    this._pruneIfNeeded();
    this._broadcast("queued", {
      id: command.id,
      category: command.category,
      action: command.action,
      route: command.route,
      created_at: command.created_at,
    });
    this._markDirty();
    return command;
  }

  enqueueBatch(items) {
    return items.map((item) => this.enqueue(item));
  }

  dispatch(clientId, limit) {
    const requeuedExpired = this._requeueExpired();
    const max = Number.isFinite(limit) ? Math.max(1, Math.min(100, limit)) : 20;
    const out = [];
    const now = Date.now();

    while (out.length < max && this.pending.length > 0) {
      const id = this.pending.shift();
      const cmd = this.commands.get(id);
      if (!cmd || cmd.status !== "queued") {
        continue;
      }
      cmd.status = "dispatched";
      cmd.delivered_to = clientId;
      cmd.dispatched_at = new Date(now).toISOString();
      cmd.lease_expires_at = new Date(now + this.leaseMs).toISOString();
      cmd.updated_at = new Date(now).toISOString();
      cmd.attempts += 1;
      this.stats.dispatched_total += 1;
      out.push(cmd);
    }

    if (out.length > 0) {
      this._broadcast("dispatched", {
        client_id: clientId,
        count: out.length,
        ids: out.map((c) => c.id),
      });
      this._markDirty();
    } else if (requeuedExpired) {
      this._markDirty();
    }

    return out;
  }

  result(input) {
    const id = input.command_id || input.id;
    if (!id) {
      return { ok: false, error: "command_id is required" };
    }
    const cmd = this.commands.get(id);
    if (!cmd) {
      return { ok: false, error: `command ${id} not found` };
    }

    const now = Date.now();
    const resultOk = input.ok === true || String(input.status || "").toLowerCase() === "ok";
    const shouldRequeue = input.requeue === true;

    // Ignore late/double result posts once a command is terminal.
    if (cmd.status === "canceled") {
      return { ok: true, command: cmd, ignored: true };
    }
    if ((cmd.status === "succeeded" || cmd.status === "failed") && !shouldRequeue) {
      return { ok: true, command: cmd, ignored: true };
    }

    cmd.result = input.result || null;
    cmd.error = input.error || null;
    cmd.updated_at = new Date(now).toISOString();

    if (shouldRequeue) {
      cmd.status = "queued";
      cmd.lease_expires_at = null;
      cmd.updated_at = new Date(now).toISOString();
      this.pending.push(cmd.id);
      this._sortPending();
      this.stats.requeued_total += 1;
      this._broadcast("requeued", { id: cmd.id, attempts: cmd.attempts });
      this._markDirty();
      return { ok: true, command: cmd };
    }

    cmd.status = resultOk ? "succeeded" : "failed";
    cmd.completed_at = new Date(now).toISOString();
    cmd.lease_expires_at = null;
    if (resultOk) {
      this.stats.succeeded_total += 1;
    } else {
      this.stats.failed_total += 1;
    }
    this._broadcast(resultOk ? "succeeded" : "failed", {
      id: cmd.id,
      error: cmd.error,
    });
    this._markDirty();
    return { ok: true, command: cmd };
  }

  cancel(id) {
    const cmd = this.commands.get(id);
    if (!cmd) {
      return { ok: false, error: `command ${id} not found` };
    }
    if (cmd.status === "succeeded" || cmd.status === "failed") {
      return { ok: false, error: `command ${id} already completed` };
    }
    cmd.status = "canceled";
    cmd.updated_at = new Date().toISOString();
    cmd.completed_at = cmd.updated_at;
    cmd.lease_expires_at = null;
    this.pending = this.pending.filter((pendingId) => pendingId !== id);
    this.stats.canceled_total += 1;
    this._broadcast("canceled", { id: cmd.id });
    this._markDirty();
    return { ok: true, command: cmd };
  }

  cancelPending() {
    const now = new Date().toISOString();
    const canceled = [];
    const keepPending = [];

    for (const pendingId of this.pending) {
      const cmd = this.commands.get(pendingId);
      if (!cmd || cmd.status !== "queued") {
        continue;
      }
      cmd.status = "canceled";
      cmd.updated_at = now;
      cmd.completed_at = now;
      cmd.lease_expires_at = null;
      canceled.push(cmd.id);
      this.stats.canceled_total += 1;
      this._broadcast("canceled", { id: cmd.id, bulk: true });
    }

    for (const cmd of this.commands.values()) {
      if (cmd.status === "dispatched") {
        cmd.status = "canceled";
        cmd.updated_at = now;
        cmd.completed_at = now;
        cmd.lease_expires_at = null;
        canceled.push(cmd.id);
        this.stats.canceled_total += 1;
        this._broadcast("canceled", { id: cmd.id, bulk: true });
      }
    }

    for (const pendingId of this.pending) {
      const cmd = this.commands.get(pendingId);
      if (cmd && cmd.status === "queued") {
        keepPending.push(pendingId);
      }
    }
    this.pending = keepPending;
    if (canceled.length > 0) {
      this._markDirty();
    }

    return {
      ok: true,
      canceled_count: canceled.length,
      command_ids: canceled,
    };
  }

  requeue(id, options = {}) {
    const cmd = this.commands.get(id);
    if (!cmd) {
      return { ok: false, error: `command ${id} not found` };
    }
    const allowCanceled = options.allowCanceled === true;
    if (cmd.status === "queued") {
      return { ok: true, command: cmd };
    }
    if (cmd.status === "canceled" && !allowCanceled) {
      return { ok: false, error: `command ${id} is canceled` };
    }
    cmd.status = "queued";
    cmd.updated_at = new Date().toISOString();
    cmd.lease_expires_at = null;
    cmd.error = null;
    this.pending.push(id);
    this._sortPending();
    this.stats.requeued_total += 1;
    this._broadcast("requeued", { id: cmd.id });
    this._markDirty();
    return { ok: true, command: cmd };
  }

  retryFailed(options = {}) {
    const limit = Math.max(1, Math.min(200, Number(options.limit) || 20));
    const includeCanceled = options.includeCanceled === true;
    const candidates = this.listRecent(500)
      .filter((cmd) => cmd && (cmd.status === "failed" || (includeCanceled && cmd.status === "canceled")))
      .slice(0, limit);

    const requeued = [];
    for (const cmd of candidates) {
      const result = this.requeue(cmd.id, { allowCanceled: includeCanceled });
      if (result.ok) {
        requeued.push(result.command.id);
      }
    }

    return {
      ok: true,
      requested_limit: limit,
      include_canceled: includeCanceled,
      requeued_count: requeued.length,
      command_ids: requeued,
    };
  }

  get(id) {
    return this.commands.get(id) || null;
  }

  listRecent(limit = 100) {
    const max = Math.max(1, Math.min(500, Number(limit) || 100));
    return Array.from(this.commands.values())
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, max);
  }

  summary() {
    const byStatus = {
      queued: 0,
      dispatched: 0,
      succeeded: 0,
      failed: 0,
      canceled: 0,
    };
    for (const cmd of this.commands.values()) {
      byStatus[cmd.status] = (byStatus[cmd.status] || 0) + 1;
    }
    return {
      total_commands: this.commands.size,
      pending_count: this.pending.length,
      by_status: byStatus,
      counters: this.stats,
      sse_clients: this.sseClients.size,
      lease_ms: this.leaseMs,
      persistence: {
        driver: this.persistDriver,
        path: this.persistDriver === "sqlite" ? this.sqlitePath : this.persistPath,
      },
    };
  }

  addSseClient(clientId, res) {
    this.sseClients.set(res, { clientId, connectedAt: new Date().toISOString() });
  }

  removeSseClient(res) {
    this.sseClients.delete(res);
  }

  listSseClients(limit = 100) {
    const max = Math.max(1, Math.min(500, Number(limit) || 100));
    return Array.from(this.sseClients.values())
      .map((client) => ({
        client_id: client.clientId || "unknown",
        connected_at: client.connectedAt || null,
      }))
      .sort((a, b) => String(b.connected_at || "").localeCompare(String(a.connected_at || "")))
      .slice(0, max);
  }

  broadcastHeartbeat() {
    this._broadcast("heartbeat", { ts: new Date().toISOString() });
  }

  flush() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this._persistToDisk();
  }

  _markDirty() {
    if (!this._isPersistenceConfigured()) {
      return;
    }
    if (this.persistTimer) {
      return;
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this._persistToDisk();
    }, this.persistDebounceMs);
    if (typeof this.persistTimer.unref === "function") {
      this.persistTimer.unref();
    }
  }

  _serializeState() {
    const commands = Array.from(this.commands.values())
      .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
    return {
      version: 1,
      persist_driver: this.persistDriver,
      lease_ms: this.leaseMs,
      max_retention: this.maxRetention,
      stats: Object.assign({}, this.stats),
      pending: this.pending.slice(),
      commands,
      persisted_at: new Date().toISOString(),
    };
  }

  _hydrateFromState(state) {
    if (!state || typeof state !== "object") {
      return;
    }

    const commands = Array.isArray(state.commands) ? state.commands : [];
    const nextCommands = new Map();
    commands.forEach((row) => {
      if (!row || typeof row !== "object") {
        return;
      }
      const id = String(row.id || "").trim();
      if (!id) {
        return;
      }
      nextCommands.set(id, Object.assign({}, row, { id }));
    });

    const pendingInput = Array.isArray(state.pending) ? state.pending : [];
    const pending = [];
    const pendingSeen = new Set();
    pendingInput.forEach((id) => {
      const key = String(id || "").trim();
      if (!key || pendingSeen.has(key)) {
        return;
      }
      const command = nextCommands.get(key);
      if (command && command.status === "queued") {
        pendingSeen.add(key);
        pending.push(key);
      }
    });

    const stats = state.stats && typeof state.stats === "object" ? state.stats : {};
    this.stats = {
      queued_total: Number.isFinite(Number(stats.queued_total)) ? Number(stats.queued_total) : 0,
      dispatched_total: Number.isFinite(Number(stats.dispatched_total)) ? Number(stats.dispatched_total) : 0,
      succeeded_total: Number.isFinite(Number(stats.succeeded_total)) ? Number(stats.succeeded_total) : 0,
      failed_total: Number.isFinite(Number(stats.failed_total)) ? Number(stats.failed_total) : 0,
      canceled_total: Number.isFinite(Number(stats.canceled_total)) ? Number(stats.canceled_total) : 0,
      requeued_total: Number.isFinite(Number(stats.requeued_total)) ? Number(stats.requeued_total) : 0,
    };
    this.commands = nextCommands;
    this.pending = pending;
    this._sortPending();
  }

  _loadFromDisk() {
    if (this.persistDriver === "sqlite") {
      this._loadFromSqlite();
      return;
    }
    if (!this.persistPath) {
      return;
    }
    try {
      if (!fs.existsSync(this.persistPath)) {
        return;
      }
      const raw = fs.readFileSync(this.persistPath, "utf8");
      if (!raw.trim()) {
        return;
      }
      const parsed = JSON.parse(raw);
      this._hydrateFromState(parsed);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[Nova4D] Failed to load command store cache: ${err.message}`);
    }
  }

  _persistToDisk() {
    if (this.persistDriver === "sqlite") {
      this._persistToSqlite();
      return;
    }
    if (!this.persistPath) {
      return;
    }
    try {
      fs.mkdirSync(path.dirname(this.persistPath), { recursive: true });
      const tmpPath = `${this.persistPath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(this._serializeState()), "utf8");
      fs.renameSync(tmpPath, this.persistPath);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[Nova4D] Failed to persist command store cache: ${err.message}`);
    }
  }

  _initPersistence() {
    if (this.persistDriver !== "sqlite") {
      return;
    }
    const DatabaseSync = resolveDatabaseSync();
    if (!DatabaseSync) {
      // eslint-disable-next-line no-console
      console.warn("[Nova4D] node:sqlite not available; falling back to json persistence.");
      this.persistDriver = "json";
      return;
    }

    const resolvedSqlitePath = this.sqlitePath
      || (this.persistPath
        ? this.persistPath.replace(/\.json$/i, ".sqlite")
        : path.join(process.cwd(), "nova4d-command-store.sqlite"));
    this.sqlitePath = resolvedSqlitePath;

    try {
      fs.mkdirSync(path.dirname(this.sqlitePath), { recursive: true });
      const db = new DatabaseSync(this.sqlitePath);
      db.exec("PRAGMA journal_mode = WAL;");
      db.exec("PRAGMA synchronous = NORMAL;");
      db.exec(`
        CREATE TABLE IF NOT EXISTS command_store_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          state_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      this.sqliteDb = db;
      this.sqliteEnabled = true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[Nova4D] Failed to initialize sqlite command store: ${err.message}`);
      this.sqliteDb = null;
      this.sqliteEnabled = false;
      this.persistDriver = "json";
    }
  }

  _isPersistenceConfigured() {
    if (this.persistDriver === "sqlite") {
      return this.sqliteEnabled && Boolean(this.sqliteDb);
    }
    return Boolean(this.persistPath);
  }

  _loadFromSqlite() {
    if (!this.sqliteEnabled || !this.sqliteDb) {
      return;
    }
    try {
      const row = this.sqliteDb
        .prepare("SELECT state_json FROM command_store_state WHERE id = 1")
        .get();
      const raw = row && typeof row.state_json === "string" ? row.state_json.trim() : "";
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw);
      this._hydrateFromState(parsed);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[Nova4D] Failed to load sqlite command store cache: ${err.message}`);
    }
  }

  _persistToSqlite() {
    if (!this.sqliteEnabled || !this.sqliteDb) {
      return;
    }
    try {
      const stateJson = JSON.stringify(this._serializeState());
      const updatedAt = new Date().toISOString();
      this.sqliteDb
        .prepare(`
          INSERT INTO command_store_state (id, state_json, updated_at)
          VALUES (1, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            state_json = excluded.state_json,
            updated_at = excluded.updated_at
        `)
        .run(stateJson, updatedAt);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[Nova4D] Failed to persist sqlite command store cache: ${err.message}`);
    }
  }

  _sortPending() {
    this.pending.sort((left, right) => {
      const a = this.commands.get(left);
      const b = this.commands.get(right);
      if (!a || !b) {
        return 0;
      }
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.created_at.localeCompare(b.created_at);
    });
  }

  _requeueExpired() {
    const now = Date.now();
    let changed = false;
    for (const cmd of this.commands.values()) {
      if (cmd.status !== "dispatched" || !cmd.lease_expires_at) {
        continue;
      }
      const leaseExpiresAt = Date.parse(cmd.lease_expires_at);
      if (!Number.isFinite(leaseExpiresAt) || leaseExpiresAt > now) {
        continue;
      }
      cmd.status = "queued";
      cmd.updated_at = new Date(now).toISOString();
      cmd.lease_expires_at = null;
      this.pending.push(cmd.id);
      this.stats.requeued_total += 1;
      changed = true;
    }
    if (changed) {
      this._sortPending();
    }
    return changed;
  }

  _pruneIfNeeded() {
    if (this.commands.size <= this.maxRetention) {
      return;
    }
    const completed = Array.from(this.commands.values())
      .filter((cmd) => cmd.status === "succeeded" || cmd.status === "failed" || cmd.status === "canceled")
      .sort((a, b) => a.updated_at.localeCompare(b.updated_at));
    const pruneCount = this.commands.size - this.maxRetention;
    for (let i = 0; i < pruneCount && i < completed.length; i += 1) {
      this.commands.delete(completed[i].id);
    }
  }

  _broadcast(event, payload) {
    const data = JSON.stringify(payload || {});
    for (const [res] of this.sseClients.entries()) {
      try {
        res.write(`event: ${event}\n`);
        res.write(`data: ${data}\n\n`);
      } catch (_err) {
        this.sseClients.delete(res);
      }
    }
  }
}

module.exports = { CommandStore };
