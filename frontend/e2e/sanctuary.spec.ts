import { test, expect } from "@playwright/test";

async function enter(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Vào trò chơi/ }).click();
  await page
    .getByRole("button", { name: /Trải nghiệm với nhân vật mẫu/ })
    .click();
  await page
    .getByRole("button", { name: /Tạo nhân vật · Vào tiên giới/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Thanh Vân Cốc", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".game-canvas canvas")).toBeVisible();
}

test("title, account registration, character creation and returning player login", async ({
  page,
}) => {
  const missing: string[] = [];
  page.on("response", (r) => {
    if (r.status() === 404) missing.push(r.url());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Tiên Linh Giới", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Đổi máy chủ/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Thanh Vân · S01");
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.getByRole("button", { name: "Kim", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Sắc bén");
  await page.getByRole("button", { name: /Vào trò chơi/ }).click();
  await page.getByRole("button", { name: "Đăng ký", exact: true }).click();
  await page.getByLabel("Gmail", { exact: true }).fill("sample@gmail.com");
  await page.getByLabel("Tên tài khoản", { exact: true }).fill("bach_lien");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("sample-password");
  await page.getByLabel("Nhập lại mật khẩu").fill("wrong-password");
  await page.getByRole("button", { name: /Tạo tài khoản mẫu/ }).click();
  await expect(page.getByRole("alert")).toContainText("chưa trùng khớp");
  await page.getByLabel("Nhập lại mật khẩu").fill("sample-password");
  await page.getByRole("button", { name: /Tạo tài khoản mẫu/ }).click();
  await page.getByLabel("Tên nhân vật", { exact: true }).fill("Bạch Liên");
  await page.getByRole("button", { name: "Mộc", exact: true }).click();
  await expect(
    page.getByText("Tu cùng cây cỏ, lấy sinh khí nuôi thân."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Avatar 3", exact: true }).click();
  await page
    .getByRole("button", { name: /Tạo nhân vật · Vào tiên giới/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Thanh Vân Cốc", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Xem toàn bộ tiền tệ" }).click();
  await expect(page.getByRole("dialog")).toContainText("Công Đức");
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.getByRole("button", { name: "Xem cảnh giới" }).click();
  await expect(page.getByRole("dialog")).toContainText("Chân Tiên");
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await page.getByRole("button", { name: "Đăng nhập tài khoản cũ" }).click();
  await page.getByLabel("Gmail hoặc tên tài khoản").fill("sample@gmail.com");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("sample-password");
  await page.getByRole("button", { name: /Tiếp tục hành trình/ }).click();
  await expect(
    page.getByRole("heading", { name: "Khởi một tiên duyên" }),
  ).toBeVisible();
  expect(missing).toEqual([]);
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
      { timeout: 20000 },
    )
    .toBeLessThan(300);
  const beforeHeal = Number(
    await page
      .getByRole("progressbar", { name: "Sinh lực" })
      .getAttribute("aria-valuenow"),
  );
  await page.getByRole("button", { name: "Dùng Hồi Linh Đan" }).click();
  expect(
    Number(
      await page
        .getByRole("progressbar", { name: "Sinh lực" })
        .getAttribute("aria-valuenow"),
    ),
  ).toBeGreaterThan(beforeHeal);
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

test("portal enforces combat level before entering the next map", async ({
  page,
}) => {
  await enter(page);
  await page.keyboard.down("w");
  await expect(
    page.getByRole("region", { name: "Cổng chuyển map" }),
  ).toBeVisible();
  await page.keyboard.up("w");
  await page.getByRole("button", { name: /Trúc Ảnh Lâm · Cấp 2/ }).click();
  await expect(page.getByRole("status")).toContainText("Cần cấp 2");
  await expect(
    page.getByRole("heading", { name: "Thanh Vân Cốc", exact: true }),
  ).toBeVisible();
});

test("manual combat levels up and successfully travels through the portal", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Progression is exercised once; touch movement and locked portals are covered separately.",
  );
  test.setTimeout(120000);
  await enter(page);
  await page.keyboard.down("a");
  await expect
    .poll(async () =>
      Number(await page.getByTestId("game-map").getAttribute("data-player-x")),
    )
    .toBeLessThan(1040);
  await page.keyboard.up("a");
  const end = Date.now() + 85000;
  while (
    Number(
      await page
        .getByRole("progressbar", { name: "Tu vi chiến đấu" })
        .getAttribute("aria-valuenow"),
    ) < 120 &&
    Date.now() < end
  ) {
    if (
      Number(
        await page
          .getByRole("progressbar", { name: "Sinh lực" })
          .getAttribute("aria-valuenow"),
      ) < 250
    )
      await page.getByRole("button", { name: "Dùng Hồi Linh Đan" }).click();
    const skill = page.getByRole("button", { name: "Thi triển Kiếm Khí" });
    if (await skill.isEnabled()) await skill.click();
    await page
      .getByRole("button", { name: "Đánh thường", exact: true })
      .click();
    await page.waitForTimeout(700);
  }
  await expect
    .poll(async () =>
      Number(
        await page
          .getByRole("progressbar", { name: "Tu vi chiến đấu" })
          .getAttribute("aria-valuenow"),
      ),
    )
    .toBeGreaterThanOrEqual(120);
  await page.keyboard.down("d");
  await expect
    .poll(
      async () =>
        Number(
          await page.getByTestId("game-map").getAttribute("data-player-x"),
        ),
      { timeout: 10000 },
    )
    .toBeGreaterThan(1180);
  await page.keyboard.up("d");
  await page.keyboard.down("w");
  await expect(
    page.getByRole("region", { name: "Cổng chuyển map" }),
  ).toBeVisible();
  await page.keyboard.up("w");
  await page.getByRole("button", { name: /Trúc Ảnh Lâm · Cấp 2/ }).click();
  await expect(
    page.getByRole("heading", { name: "Trúc Ảnh Lâm", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("unlocked-region.png") });
});
