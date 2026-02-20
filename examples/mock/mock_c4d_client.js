"use strict";

const http = require("http");

const HOST = process.env.NOVA4D_HOST || "localhost";
const PORT = parseInt(process.env.NOVA4D_PORT || "30010", 10);
const API_KEY = process.env.NOVA4D_API_KEY || "";
const CLIENT_ID = process.env.MOCK_CLIENT_ID || "mock-c4d";
const POLL_MS = parseInt(process.env.MOCK_POLL_MS || "1000", 10);
const RUN_SECONDS = parseInt(process.env.MOCK_RUN_SECONDS || "0", 10);

const WORLD = {
  objects: new Map(),
  materials: new Set(),
  cloners: new Set(),
  history: [],
};

function req(method, route, payload) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : null;
    const headers = { "Content-Type": "application/json", "X-Client-Id": CLIENT_ID };
    if (API_KEY) {
      headers["X-API-Key"] = API_KEY;
    }
    if (body) {
      headers["Content-Length"] = Buffer.byteLength(body);
    }

    const request = http.request(
      {
        hostname: HOST,
        port: PORT,
        path: route,
        method,
        headers,
        timeout: 20000,
      },
      (response) => {
        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          if (!data) {
            resolve({ status: "ok" });
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (_err) {
            resolve({ raw: data, statusCode: response.statusCode });
          }
        });
      }
    );

    request.on("error", reject);
    request.on("timeout", () => {
      request.destroy(new Error("request timed out"));
    });

    if (body) {
      request.write(body);
    }
    request.end();
  });
}

function execute(command) {
  const action = command.action;
  const payload = command.payload || {};

  if (action === "spawn-object") {
    const name = payload.name || `Object_${WORLD.objects.size + 1}`;
    WORLD.objects.set(name, {
      name,
      type: payload.object_type || payload.class_name || "cube",
      position: payload.position || [0, 100, 0],
      rotation: payload.rotation || [0, 0, 0],
      scale: payload.scale || [1, 1, 1],
    });
    return { created: name };
  }

  if (action === "set-transform") {
    const target = payload.target_name;
    if (!WORLD.objects.has(target)) {
      throw new Error(`missing object ${target}`);
    }
    const current = WORLD.objects.get(target);
    WORLD.objects.set(target, Object.assign({}, current, {
      position: payload.position || current.position,
      rotation: payload.rotation || current.rotation,
      scale: payload.scale || current.scale,
    }));
    return { updated: target };
  }

  if (action === "create-standard-material" || action === "create-redshift-material" || action === "create-arnold-material") {
    const name = payload.name || `${action}_${WORLD.materials.size + 1}`;
    WORLD.materials.add(name);
    return { material: name };
  }

  if (action === "create-cloner") {
    const name = payload.name || `Cloner_${WORLD.cloners.size + 1}`;
    WORLD.cloners.add(name);
    return { cloner: name };
  }

  if (action === "delete-object") {
    const target = payload.target_name || payload.name;
    WORLD.objects.delete(target);
    return { deleted: target };
  }

  if (action === "test-ping") {
    return { message: payload.message || "Nova4D connected" };
  }

  return { accepted: action, payload };
}

async function loop() {
  const started = Date.now();
  while (true) {
    if (RUN_SECONDS > 0 && Date.now() - started > RUN_SECONDS * 1000) {
      break;
    }

    let response;
    try {
      response = await req("GET", `/nova4d/commands?client_id=${encodeURIComponent(CLIENT_ID)}&limit=20`);
    } catch (err) {
      console.error("poll error", err.message);
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      continue;
    }

    const commands = Array.isArray(response.commands) ? response.commands : [];
    for (const command of commands) {
      let ok = true;
      let result = null;
      let error = null;
      try {
        result = execute(command);
        WORLD.history.push({ id: command.id, action: command.action, ok: true });
      } catch (err) {
        ok = false;
        error = err.message;
        WORLD.history.push({ id: command.id, action: command.action, ok: false, error });
      }

      try {
        await req("POST", "/nova4d/results", {
          command_id: command.id,
          ok,
          status: ok ? "ok" : "error",
          result,
          error,
        });
      } catch (err) {
        console.error("result post failed", err.message);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }

  console.log(JSON.stringify({
    status: "done",
    objects: WORLD.objects.size,
    materials: WORLD.materials.size,
    cloners: WORLD.cloners.size,
    history: WORLD.history.slice(-20),
  }, null, 2));
}

loop().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
