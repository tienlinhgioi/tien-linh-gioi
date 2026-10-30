import { test, expect } from "@playwright/test";

async function enter(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: /Trải nghiệm với nhân vật mẫu/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Thanh Vân Cốc", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".game-canvas canvas")).toBeVisible();
}

test("register, validate confirmation, and sign out of a sample session", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Đăng ký", exact: true })
    .first()
    .click();
  await page.getByLabel("Đạo danh", { exact: true }).fill("Bạch Liên");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("sample-password");
  await page.getByLabel("Nhập lại mật khẩu").fill("wrong-password");
  await page.getByRole("button", { name: /Khai mở tiên duyên/ }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Hai mật khẩu chưa trùng khớp.",
  );
  await page.getByLabel("Nhập lại mật khẩu").fill("sample-password");
  await page.getByRole("button", { name: /Khai mở tiên duyên/ }).click();
  await expect(
    page.getByRole("heading", { name: "Thanh Vân Cốc" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(
    page.getByRole("heading", { name: "Trở về tiên cảnh" }),
  ).toBeVisible();
  await page.getByLabel("Đạo danh", { exact: true }).fill("Thanh Vân");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("sample-password");
  await page.getByRole("button", { name: /Bước vào Tiên Giới/ }).click();
  await expect(
    page.getByRole("heading", { name: "Thanh Vân Cốc" }),
  ).toBeVisible();
});

test("move the character, fight a monster, receive loot and inspect the inventory", async ({
  page,
}) => {
  const errors: string[] = [];
  const backendCalls: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (r.url().includes("/api/") || r.url().includes("socket.io"))
      backendCalls.push(r.url());
  });
  await enter(page);
  const map = page.getByTestId("game-map");
  await page.keyboard.down("a");
  await expect
    .poll(async () => Number(await map.getAttribute("data-player-x")), {
      timeout: 10000,
    })
    .toBeLessThan(1040);
  await page.keyboard.up("a");
  await expect
    .poll(
      async () =>
        Number(
          await page
            .getByRole("progressbar", { name: "Sinh lực" })
            .getAttribute("aria-valuenow"),
        ),
      { timeout: 10000 },
    )
    .toBeLessThan(360);
  await page.getByRole("button", { name: "Dùng Hồi Linh Đan" }).click();
  await expect(
    page.getByRole("progressbar", { name: "Sinh lực" }),
  ).toHaveAttribute("aria-valuenow", "360");
  await page.getByRole("button", { name: "Thi triển Kiếm Khí" }).click();
  await expect(
    page.getByRole("button", { name: "Thi triển Kiếm Khí" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Đánh thường" }).click();
  await expect
    .poll(async () =>
      Number(
        await page
          .getByRole("progressbar", { name: "Tu vi chiến đấu" })
          .getAttribute("aria-valuenow"),
      ),
    )
    .toBeGreaterThan(0);
  await expect(page.getByRole("status")).toContainText("Hạ Mộc Linh");
  await page.getByRole("button", { name: "Mở túi đồ" }).click();
  await expect(page.getByRole("dialog")).toContainText("Linh thảo × 1");
  await expect(page.getByRole("dialog")).toContainText("1.298 linh thạch");
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.getByRole("button", { name: "Mở nhật ký", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Hạ Mộc Linh");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(backendCalls).toEqual([]);
});

test("PC and touch controls fit the viewport and move the player", async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const map = page.getByTestId("game-map");
  if (isMobile) {
    const joystick = page.getByRole("group", { name: "Joystick di chuyển" });
    await expect(joystick).toBeVisible();
    const box = (await joystick.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 35, box.y + box.height / 2);
    await expect
      .poll(async () => Number(await map.getAttribute("data-player-x")), {
        timeout: 10000,
      })
      .toBeLessThan(1150);
    await page.mouse.up();
  } else {
    await expect(page.locator(".desktop-controls")).toBeVisible();
    await page.keyboard.down("ArrowUp");
    await expect
      .poll(async () => Number(await map.getAttribute("data-player-y")), {
        timeout: 10000,
      })
      .toBeLessThan(600);
    await page.keyboard.up("ArrowUp");
  }
  await page.getByRole("button", { name: "Hướng dẫn điều khiển" }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("dialog")).toContainText(
    "Camera tự theo nhân vật.",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
