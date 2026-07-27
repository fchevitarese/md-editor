import { test, expect, type Page } from "@playwright/test";

const FILES: Record<string, string> = {
  "/tmp/a.md": "# A",
  "/tmp/b.md": "# B",
  "/tmp/c.md": "# C",
};

// Stub the Tauri IPC bridge so the app boots a real multi-tab session in a browser
async function mockTauri(page: Page) {
  await page.addInitScript((files: Record<string, string>) => {
    (window as any).__TAURI_INTERNALS__ = {
      transformCallback: (cb: unknown) => cb,
      invoke: (cmd: string, args: any) => {
        switch (cmd) {
          case "load_session":
            return Promise.resolve({
              open_files: Object.keys(files),
              active_file: Object.keys(files)[0],
              dir_path: null,
              scroll_positions: {},
            });
          case "read_file":
            return Promise.resolve(files[args.path] ?? "");
          case "load_preferences":
            return Promise.resolve({ font_size: 16, show_minimap: true });
          case "get_initial_file_path":
            return Promise.resolve(null);
          default:
            return Promise.resolve(null);
        }
      },
    };
  }, FILES);
}

test.describe("MD Editor - tab reopen", () => {
  test.beforeEach(async ({ page }) => {
    await mockTauri(page);
    await page.goto("/");
    await expect(page.locator(".tab-item")).toHaveCount(3);
  });

  test("Ctrl+Shift+T reopens the last closed tab at its original index", async ({ page }) => {
    // Close the middle tab (b.md) via its close button
    await page.locator(".tab-item").nth(1).locator(".tab-close").click();
    await expect(page.locator(".tab-item")).toHaveCount(2);
    await expect(page.locator(".tab-item")).toHaveText([/a\.md/, /c\.md/]);

    await page.keyboard.press("Control+Shift+T");
    await expect(page.locator(".tab-item")).toHaveCount(3);
    await expect(page.locator(".tab-item")).toHaveText([/a\.md/, /b\.md/, /c\.md/]);
    // Reopened tab becomes active
    await expect(page.locator(".tab-item--active")).toHaveText(/b\.md/);
  });

  test("reopens in LIFO order across multiple closes", async ({ page }) => {
    await page.locator(".tab-item").nth(0).locator(".tab-close").click();
    await page.locator(".tab-item").nth(0).locator(".tab-close").click();
    await expect(page.locator(".tab-item")).toHaveText([/c\.md/]);

    await page.keyboard.press("Control+Shift+T");
    await expect(page.locator(".tab-item--active")).toHaveText(/b\.md/);

    await page.keyboard.press("Control+Shift+T");
    await expect(page.locator(".tab-item--active")).toHaveText(/a\.md/);
    await expect(page.locator(".tab-item")).toHaveText([/a\.md/, /b\.md/, /c\.md/]);
  });

  test("Ctrl+W closes the active tab and Ctrl+Shift+T brings it back", async ({ page }) => {
    await page.locator(".tab-item").nth(2).click();
    await expect(page.locator(".tab-item--active")).toHaveText(/c\.md/);

    await page.keyboard.press("Control+w");
    await expect(page.locator(".tab-item")).toHaveText([/a\.md/, /b\.md/]);

    await page.keyboard.press("Control+Shift+T");
    await expect(page.locator(".tab-item")).toHaveText([/a\.md/, /b\.md/, /c\.md/]);
    await expect(page.locator(".tab-item--active")).toHaveText(/c\.md/);
  });

  test("reopening the last tab replaces the pristine Untitled placeholder", async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await page.locator(".tab-item").first().locator(".tab-close").click();
    }
    await expect(page.locator(".tab-item")).toHaveText([/Untitled\.md/]);

    await page.keyboard.press("Control+Shift+T");
    await expect(page.locator(".tab-item")).toHaveCount(1);
    await expect(page.locator(".tab-item")).toHaveText([/c\.md/]);
  });

  test("Ctrl+Shift+T is a no-op when nothing was closed", async ({ page }) => {
    await page.keyboard.press("Control+Shift+T");
    await expect(page.locator(".tab-item")).toHaveCount(3);
  });
});
