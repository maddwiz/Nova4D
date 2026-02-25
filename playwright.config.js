const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/ui",
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:30110",
    headless: true,
  },
  webServer: {
    command: "NOVA4D_PORT=30110 npm start",
    url: "http://127.0.0.1:30110/nova4d/health",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
