const { test, expect } = require("@playwright/test");

const STUDIO_SETTINGS_KEY = "nova4d.studio.settings.v1";
const RUN_MONITOR_HISTORY_KEY = "nova4d.studio.run_monitor_history.v1";

async function openStudio(page, { settings = {}, history = null } = {}) {
  await page.addInitScript(({ settingsKey, historyKey, settingsState, historyState }) => {
    const baseSettings = {
      live_stream_enabled: false,
      auto_monitor_runs: false,
    };
    window.localStorage.setItem(settingsKey, JSON.stringify(Object.assign(baseSettings, settingsState || {})));
    if (Array.isArray(historyState)) {
      window.localStorage.setItem(historyKey, JSON.stringify(historyState));
    } else {
      window.localStorage.removeItem(historyKey);
    }
  }, {
    settingsKey: STUDIO_SETTINGS_KEY,
    historyKey: RUN_MONITOR_HISTORY_KEY,
    settingsState: settings,
    historyState: history,
  });

  await page.goto("/nova4d/studio");
  await expect(page.getByRole("heading", { name: "Nova4D Studio" })).toBeVisible();
}

test("loads Studio controls including cinematic smoke", async ({ page }) => {
  await openStudio(page);

  await expect(page.getByRole("button", { name: "Run Cinematic Smoke" })).toBeVisible();
  await expect(page.locator("#workflowGltfOutput")).toBeVisible();
  await expect(page.locator("#cinematicSmokeStatus")).toContainText("idle");
  await expect(page.locator("#runMonitorHistoryStatus")).toContainText("No run monitor history yet.");
});

test("enables monitor history controls and loads selected session", async ({ page }) => {
  const history = [
    {
      id: "hist-1",
      source: "Run",
      status: "completed",
      started_at: "2026-02-25T10:00:00.000Z",
      ended_at: "2026-02-25T10:00:10.000Z",
      duration_ms: 10000,
      command_ids: ["cmd-a"],
      commands: [
        {
          id: "cmd-a",
          route: "/nova4d/scene/spawn-object",
          action: "spawn-object",
          status: "succeeded",
          error: "",
        },
      ],
    },
    {
      id: "hist-2",
      source: "Run retry",
      status: "completed",
      started_at: "2026-02-25T10:05:00.000Z",
      ended_at: "2026-02-25T10:05:12.000Z",
      duration_ms: 12000,
      command_ids: ["cmd-b"],
      commands: [
        {
          id: "cmd-b",
          route: "/nova4d/render/frame",
          action: "render-frame",
          status: "failed",
          error: "mock failure",
        },
      ],
    },
  ];

  await openStudio(page, { history });

  const historySelect = page.locator("#runMonitorHistorySelect");
  await expect(historySelect.locator("option")).toHaveCount(3);

  await historySelect.selectOption({ index: 2 });
  await expect(page.getByRole("button", { name: "Load History Session" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Export History Session" })).toBeEnabled();

  await page.getByRole("button", { name: "Load History Session" }).click();
  await expect(page.locator("#runMonitorStatus")).toContainText("history loaded");
  await expect(page.locator("#runMonitorHistoryStatus")).toContainText("Loaded selected run monitor history session.");
});

test("runs cinematic smoke and shows stage progress/artifact links", async ({ page }) => {
  const commandRows = [
    {
      id: "cmd-1",
      route: "/nova4d/scene/spawn-object",
      action: "spawn-object",
      reason: "Create workflow base cube.",
      status: "queued",
    },
    {
      id: "cmd-2",
      route: "/nova4d/render/frame",
      action: "render-frame",
      reason: "Render workflow preview frame.",
      status: "queued",
    },
    {
      id: "cmd-3",
      route: "/nova4d/blender/import-gltf",
      action: "import-blender-gltf",
      reason: "Validate Blender glTF import path.",
      status: "queued",
    },
  ];

  let runStartedAt = 0;

  await page.route("**/nova4d/workflows/run", async (route) => {
    if (route.request().method() !== "POST") {
      return route.continue();
    }
    const body = JSON.parse(route.request().postData() || "{}");
    if (body.workflow_id !== "cinematic_smoke") {
      return route.continue();
    }
    runStartedAt = Date.now();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        workflow: {
          id: "cinematic_smoke",
          name: "Cinematic Smoke",
          description: "UI smoke mock",
        },
        options: {
          render_output: "/tmp/test-smoke-frame.png",
          gltf_output: "/tmp/test-smoke.gltf",
        },
        queued: commandRows,
        blocked_commands: [],
      }),
    });
  });

  await page.route(/\/nova4d\/commands\/cmd-\d+$/, async (route) => {
    const requestUrl = route.request().url();
    const id = requestUrl.split("/").pop() || "";
    const elapsed = Date.now() - runStartedAt;
    let status = "queued";
    if (elapsed > 900) {
      status = "succeeded";
    } else if (elapsed > 350) {
      status = id === "cmd-1" ? "succeeded" : "dispatched";
    }
    const template = commandRows.find((item) => item.id === id);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        command: {
          id,
          route: template?.route || "/nova4d/test/ping",
          action: template?.action || "test-ping",
          status,
          error: "",
        },
      }),
    });
  });

  await openStudio(page, {
    settings: {
      auto_monitor_runs: false,
    },
  });

  await page.getByRole("button", { name: "Run Cinematic Smoke" }).click();

  await expect(page.locator("#cinematicSmokeProgress")).toContainText("Create workflow base cube.");
  await expect(page.locator("#cinematicSmokeArtifacts")).toContainText("/tmp/test-smoke-frame.png");
  await expect(page.locator("#cinematicSmokeArtifacts")).toContainText("/tmp/test-smoke.gltf");
  await expect(page.locator("#cinematicSmokeStatus")).toContainText("3/3 complete", { timeout: 15000 });
  await expect(page.locator("#cinematicSmokeProgress")).toContainText("succeeded");
});
