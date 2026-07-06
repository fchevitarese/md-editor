import { test, expect } from "@playwright/test";

test.describe("MD Editor - view modes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders the titlebar with open buttons", async ({ page }) => {
    await expect(page.locator(".titlebar")).toBeVisible();
    await expect(page.locator(".titlebar .btn-icon")).toHaveCount(2);
  });

  test("starts in wysiwyg mode with editor area visible", async ({ page }) => {
    await expect(page.locator(".ProseMirror")).toBeVisible();
    await expect(page.locator(".editor-scroll")).toBeVisible();
  });

  test("switches to split mode and shows raw textarea + preview", async ({ page }) => {
    await page.locator('[title="Split view"]').click();
    await expect(page.locator(".split-pane.split-raw")).toBeVisible();
    await expect(page.locator(".split-pane.split-preview")).toBeVisible();
    await expect(page.locator(".raw-textarea")).toBeVisible();
  });

  test("switches to preview mode via button click", async ({ page }) => {
    await page.locator('[title="Preview"]').click();
    await expect(page.locator('[title="Preview"]')).toHaveClass(/active/);
  });

  test("view mode buttons have correct titles", async ({ page }) => {
    await expect(page.locator('[title="WYSIWYG"]')).toBeVisible();
    await expect(page.locator('[title="Split view"]')).toBeVisible();
    await expect(page.locator('[title="Preview"]')).toBeVisible();
  });

  test("minimap is visible by default", async ({ page }) => {
    await expect(page.locator(".minimap")).toBeVisible();
    await expect(page.locator(".minimap-content")).toBeVisible();
  });

  test("toolbar formatting buttons are visible", async ({ page }) => {
    await expect(page.locator('[title="Bold (Ctrl+B)"]')).toBeVisible();
    await expect(page.locator('[title="Italic (Ctrl+I)"]')).toBeVisible();
    await expect(page.locator('[title="Heading 1"]')).toBeVisible();
  });

  test("writes text in wysiwyg and sees it rendered", async ({ page }) => {
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.fill("Hello World");
    await expect(editor).toContainText("Hello World");
  });

  test("font size label shows current value", async ({ page }) => {
    await expect(page.locator(".font-size-label")).toBeVisible();
    await expect(page.locator(".font-size-label")).toHaveText("16");
  });

  test("save and export buttons are present", async ({ page }) => {
    await expect(page.locator('[title="Save (Ctrl+S)"]')).toBeVisible();
    await expect(page.locator('[title="Export PDF"]')).toBeVisible();
  });
});
