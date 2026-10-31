import { expect, test, chromium, type Page } from "@playwright/test";

async function enterWorld(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Vào trò chơi/ }).click();
  await page
    .getByRole("button", { name: /Trải nghiệm với nhân vật mẫu/ })
    .click();
  await page
    .getByRole("button", { name: /Tạo nhân vật · Vào tiên giới/ })
    .click();
  await expect(page.locator(".game-canvas canvas")).toBeVisible();
}

async function assertPlayable(page: Page) {
  const map = page.getByTestId("game-map");
  const start = Number(await map.getAttribute("data-player-x"));
  await page.keyboard.down("a");
  await expect
    .poll(async () => Number(await map.getAttribute("data-player-x")))
    .toBeLessThan(start - 40);
  await page.keyboard.up("a");
  await page.getByRole("button", { name: "Thi triển Kiếm Khí" }).click();
  await expect(
    page.getByRole("button", { name: "Thi triển Kiếm Khí" }),
  ).toBeDisabled();
}

test("a successful support probe followed by refused GPU contexts still renders and plays", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      options?: unknown,
    ) {
      // The support probe succeeds, but actual context allocation fails.
      if (
        kind.startsWith("webgl") &&
        options &&
        "powerPreference" in Object(options)
      )
        return null;
      return original.call(
        this,
        kind as "2d",
        options as CanvasRenderingContext2DSettings,
      );
    } as typeof original;
  });
  await enterWorld(page);
  const canvas = page.locator(".game-canvas canvas");
  await expect(canvas).toHaveAttribute("data-renderer", "canvas");
  await expect
    .poll(() =>
      canvas.evaluate((element: HTMLCanvasElement) => {
        const context = element.getContext("2d")!;
        const { data } = context.getImageData(
          0,
          0,
          element.width,
          element.height,
        );
        const colors = new Set<number>();
        for (let i = 0; i < data.length; i += 4 * 127)
          colors.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
        return colors.size;
      }),
    )
    .toBeGreaterThan(10);
  await assertPlayable(page);
  expect(errors).toEqual([]);
});

test("WebGL1-only browsers still render and play", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      options?: unknown,
    ) {
      if (kind === "webgl2") return null;
      return original.call(
        this,
        kind as "2d",
        options as CanvasRenderingContext2DSettings,
      );
    } as typeof original;
  });
  await enterWorld(page);
  await expect(page.locator(".game-canvas canvas")).toHaveAttribute(
    "data-renderer",
    "webgl1",
  );
  await assertPlayable(page);
  expect(errors).toEqual([]);
});

test("WebGL2 renderer initialization failure retries WebGL1", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const original = WebGL2RenderingContext.prototype.getExtension;
    WebGL2RenderingContext.prototype.getExtension = function (name: string) {
      // Fail after the real context exists, inside Pixi's renderer.init().
      if (name === "EXT_texture_filter_anisotropic")
        throw new Error("GPU initialization refused");
      return original.call(this, name);
    };
  });
  await enterWorld(page);
  await expect(page.locator(".game-canvas canvas")).toHaveAttribute(
    "data-renderer",
    "webgl1",
  );
  await assertPlayable(page);
  expect(errors).toEqual([]);
});

test.describe("GPU disabled in the browser", () => {
  test("Canvas keeps the map playable without WebGL", async ({
    baseURL,
  }, info) => {
    const browser = await chromium.launch({
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      args: ["--disable-webgl"],
    });
    const context = await browser.newContext({
      baseURL,
      viewport: info.project.use.viewport,
      isMobile: info.project.use.isMobile,
      hasTouch: info.project.use.hasTouch,
    });
    const page = await context.newPage();
    try {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await enterWorld(page);
      await expect(page.locator(".game-canvas canvas")).toHaveAttribute(
        "data-renderer",
        "canvas",
      );
      await assertPlayable(page);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  });
});
