"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createWorkflowPlanner,
  workflowDefaults,
  buildWorkflowCommands,
} = require("../../server/workflow_planner");

test("createWorkflowPlanner requires applyCommandGuards function", () => {
  assert.throws(
    () => createWorkflowPlanner({}),
    /applyCommandGuards must be a function/
  );
});

test("workflowDefaults normalizes names and numeric fields", () => {
  const defaults = workflowDefaults({
    object_name: "  HeroCube  ",
    cloner_name: "  HeroCloner ",
    material_name: "  HeroMat ",
    frame_start: "-10",
    frame_end: "90",
    start_value: "1.25",
    end_value: "220.5",
    render_frame: "42",
    render_output: " /tmp/render.png ",
    gltf_output: " /tmp/out.gltf ",
  });

  assert.equal(defaults.object_name, "HeroCube");
  assert.equal(defaults.cloner_name, "HeroCloner");
  assert.equal(defaults.material_name, "HeroMat");
  assert.equal(defaults.frame_start, -10);
  assert.equal(defaults.frame_end, 90);
  assert.equal(defaults.start_value, 1.25);
  assert.equal(defaults.end_value, 220.5);
  assert.equal(defaults.render_frame, 42);
  assert.equal(defaults.render_output, "/tmp/render.png");
  assert.equal(defaults.gltf_output, "/tmp/out.gltf");
});

test("buildWorkflowCommands returns expected cinematic smoke sequence", () => {
  const commands = buildWorkflowCommands("cinematic_smoke", {
    object_name: "SmokeCube",
    material_name: "SmokeMat",
    gltf_output: "/tmp/smoke.gltf",
  });
  assert.equal(commands.length, 9);
  assert.equal(commands[0].route, "/nova4d/scene/spawn-object");
  assert.equal(commands[2].route, "/nova4d/material/create-redshift");
  assert.equal(commands[8].route, "/nova4d/blender/import-gltf");
  assert.equal(commands[8].payload.file_path, "/tmp/smoke.gltf");
});

test("buildWorkflowPlan returns guarded commands and enforces max_commands", () => {
  const planner = createWorkflowPlanner({
    applyCommandGuards(commands, safetyInput) {
      return {
        policy: safetyInput,
        allowed: commands.slice(0, 2),
        blocked: commands.slice(2).map((command) => ({
          route: command.route,
          reason: "blocked-in-test",
        })),
      };
    },
  });

  const result = planner.buildWorkflowPlan(
    "cinematic_smoke",
    { object_name: "PlanCube" },
    { mode: "strict" },
    5
  );

  assert.equal(result.ok, true);
  assert.equal(result.workflow.id, "cinematic_smoke");
  assert.equal(result.options.object_name, "PlanCube");
  assert.equal(result.max_commands, 5);
  assert.equal(result.guarded.allowed.length, 2);
  assert.equal(result.guarded.blocked.length, 3);
  assert.equal(result.guarded.policy.mode, "strict");
});

test("buildWorkflowPlan returns workflow not found for unknown id", () => {
  const planner = createWorkflowPlanner({
    applyCommandGuards(commands) {
      return { policy: {}, allowed: commands, blocked: [] };
    },
  });

  const result = planner.buildWorkflowPlan("not-a-workflow", {}, {}, 10);
  assert.equal(result.ok, false);
  assert.equal(result.error, "workflow not found");
});
