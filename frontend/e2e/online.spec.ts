import {
  test,
  expect,
  type Page,
  type APIRequestContext,
  type Browser,
} from "@playwright/test";
import { createRequire } from "node:module";
// Contract tests use the in-memory HTTP/MessagePack fixture, not Prisma or a deployment.
const require = createRequire(import.meta.url);
const { io } = require("socket.io-client");
const parser = require("socket.io-msgpack-parser");
const endpoint = "http://127.0.0.1:4351",
  password = "contract-password";
test.setTimeout(90_000);
async function called(request: APIRequestContext, event: string, count = 1) {
  await expect
    .poll(
      async () =>
        (
          (await (await request.get(`${endpoint}/__calls`)).json()) as string[]
        ).filter((e) => e === event).length,
    )
    .toBeGreaterThanOrEqual(count);
}
async function push(
  request: APIRequestContext,
  username: string,
  event: string,
  payload: unknown,
) {
  expect(
    (
      await request.post(`${endpoint}/__push`, {
        data: { username, event, payload },
      })
    ).ok(),
  ).toBeTruthy();
}
async function socketRequest(
  username: string,
  event: string,
  payload?: unknown,
) {
  const socket = io(endpoint, {
    auth: { token: `fixture-token-${username}` },
    parser,
    forceNew: true,
  });
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    });
    return await new Promise<any>((resolve, reject) => {
      const callback = (error: Error | null, data: unknown) =>
        error ? reject(error) : resolve(data);
      if (payload === undefined) socket.timeout(5000).emit(event, callback);
      else socket.timeout(5000).emit(event, payload, callback);
    });
  } finally {
    socket.disconnect();
  }
}
async function account(
  request: APIRequestContext,
  username: string,
  name: string,
) {
  expect(
    (
      await request.post(`${endpoint}/api/register`, {
        data: { email: `${username}@gmail.com`, username, password },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (await socketRequest(username, "character:create", { name })).character
      .name,
  ).toBe(name);
}
async function auth(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Vào trò chơi/ }).click();
  await page.getByLabel("Địa chỉ máy chủ").fill(endpoint);
}
async function join(page: Page) {
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .locator(".online-card")
    .filter({ hasText: "Thanh Vân Thôn" })
    .getByRole("button", { name: "Tiến vào" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('[data-testid="online-map"] canvas')).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Thanh Vân Thôn", exact: true }),
  ).toBeVisible();
}
async function login(page: Page, username: string) {
  await auth(page);
  await page.getByLabel("Gmail hoặc tên tài khoản").fill(username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Tiếp tục hành trình/ }).click();
  await join(page);
}
async function open(page: Page, label: string) {
  const dialog = page.getByRole("dialog");
  if (await dialog.count())
    await dialog
      .locator(".online-tabs")
      .getByRole("button", { name: label, exact: false })
      .click();
  else
    await page
      .locator(".online-menu")
      .getByRole("button", { name: label, exact: false })
      .click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Đang tải/ })).toHaveCount(0);
  return dialog;
}
async function close(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Đóng", exact: true })
    .click();
}
async function confirm(page: Page) {
  await page
    .locator(".online-confirm")
    .getByRole("button", { name: "Xác nhận", exact: true })
    .click();
  await expect(page.locator(".online-confirm")).toHaveCount(0);
}
async function pair(browser: Browser, request: APIRequestContext) {
  await account(request, "first", "Thanh Liên");
  await account(request, "second", "Bạch Vân");
  const first = await browser.newContext(),
    second = await browser.newContext();
  const a = await first.newPage(),
    b = await second.newPage();
  await login(a, "first");
  await login(b, "second");
  return {
    a,
    b,
    dispose: async () => {
      await first.close();
      await second.close();
    },
  };
}
test.beforeEach(async ({ request }) => {
  expect((await request.post(`${endpoint}/__reset`)).ok()).toBeTruthy();
});

test("HTTP registration, authoritative movement, combat, death and connection freeze", async ({
  page,
  request,
}, testInfo) => {
  await auth(page);
  await page.getByRole("button", { name: "Đăng ký", exact: true }).click();
  await page.getByLabel("Gmail", { exact: true }).fill("journey@gmail.com");
  await page.getByLabel("Tên tài khoản", { exact: true }).fill("journey");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByLabel("Nhập lại mật khẩu").fill(password);
  await page.getByRole("button", { name: /Tạo tài khoản/ }).click();
  await page.getByLabel("Tên nhân vật", { exact: true }).fill("Tiên Lộ");
  await page
    .getByRole("button", { name: /Tạo nhân vật · Vào tiên giới/ })
    .click();
  await join(page);
  await called(request, "register");
  await called(request, "character:create");
  const map = page.getByTestId("online-map");
  if (testInfo.project.name === "desktop") {
    await page.keyboard.down("d");
    await expect
      .poll(async () => Number(await map.getAttribute("data-player-x")))
      .toBeGreaterThan(5);
    await page.keyboard.up("d");
  } else {
    const box = (await page
      .getByRole("group", { name: "Joystick di chuyển" })
      .boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
    await page.mouse.down();
    await expect
      .poll(async () => Number(await map.getAttribute("data-player-x")))
      .toBeGreaterThan(5);
    await page.mouse.up();
  }
  await called(request, "move");
  await push(request, "journey", "move:rejected", { x: 3, y: 4 });
  await expect(map).toHaveAttribute("data-player-x", "3");
  await expect(map).toHaveAttribute("data-player-y", "4");
  await page.getByRole("button", { name: "Đánh thường", exact: true }).click();
  await page.getByRole("button", { name: "Đánh thường", exact: true }).click();
  await called(request, "cast", 2);
  await expect(
    page.getByRole("progressbar", { name: "Tu vi chiến đấu" }),
  ).toHaveAttribute("aria-valuenow", "20");
  expect((await socketRequest("journey", "player:me")).character.exp).toBe(20);
  await push(request, "journey", "player:died", { respawnIn: 3 });
  await expect(
    page.getByRole("heading", { name: "Đang chờ hồi sinh" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Đánh thường", exact: true }),
  ).toBeDisabled();
  await push(request, "journey", "player:respawned", {
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
  });
  await expect(
    page.getByRole("heading", { name: "Đang chờ hồi sinh" }),
  ).toHaveCount(0);
  await page.context().setOffline(true);
  await expect(
    page.getByText("Mất kết nối máy chủ", { exact: true }),
  ).toBeVisible({ timeout: 45000 });
  await expect(
    page.getByRole("button", { name: "Đánh thường", exact: true }),
  ).toBeDisabled();
  await page.context().setOffline(false);
  await expect(
    page.getByText("Mất kết nối máy chủ", { exact: true }),
  ).toHaveCount(0, { timeout: 20000 });
});

test("inventory, equipment, learned skill, merchant, currencies and actual map IDs", async ({
  page,
  request,
}) => {
  await account(request, "inventory", "Linh Đan");
  await login(page, "inventory");
  let dialog = await open(page, "Túi đồ");
  const potion = dialog
    .locator(".online-card")
    .filter({ hasText: "Hồi Huyết Đan" });
  await expect(potion).toContainText("×5");
  await potion.getByRole("button", { name: "Dùng 1" }).click();
  await expect(potion).toContainText("×4");
  await potion.getByRole("spinbutton").fill("2");
  await potion.getByRole("button", { name: "Bỏ", exact: true }).click();
  await confirm(page);
  await expect(potion).toContainText("×2");
  dialog = await open(page, "Trang bị");
  await dialog
    .locator(".online-card")
    .filter({ hasText: "Thiết Kiếm" })
    .getByRole("button", { name: "Trang bị", exact: true })
    .click();
  const weapon = dialog.locator(".online-gear").filter({ hasText: "Vũ khí" });
  await expect(weapon).toContainText("Thiết Kiếm");
  await expect(dialog.locator(".online-gear")).toHaveCount(5);
  await weapon.getByRole("button", { name: "Tháo xuống" }).click();
  await expect(weapon).toContainText("Chưa trang bị");
  dialog = await open(page, "Công pháp");
  const skill = dialog.locator(".online-card").filter({ hasText: "Hỏa Cầu" });
  await skill.getByRole("button", { name: "Học công pháp" }).click();
  await expect(dialog).toContainText("2 điểm kỹ năng");
  await skill.getByRole("button", { name: "Chọn chiến đấu" }).click();
  await page.getByRole("button", { name: "Thi triển kỹ năng" }).click();
  await called(request, "cast");
  dialog = await open(page, "Cửa hàng");
  const goods = dialog
    .locator(".online-card")
    .filter({ hasText: "Hồi Huyết Đan" });
  await goods.getByRole("spinbutton").fill("2");
  await goods.getByRole("button", { name: "Mua", exact: true }).click();
  await expect(goods).toContainText("Trong túi: 5");
  await goods.getByRole("spinbutton").fill("1");
  await goods.getByRole("button", { name: "Bán", exact: true }).click();
  await expect(goods).toContainText("Trong túi: 4");
  await close(page);
  await page.getByRole("button", { name: "Xem toàn bộ tiền tệ" }).click();
  await expect(page.locator(".online-currency-grid")).toContainText("990");
  expect(
    (await socketRequest("inventory", "player:me")).character.currencies[0]
      .amount,
  ).toBe(990);
  dialog = await open(page, "Thiên hạ");
  await dialog
    .locator(".online-card")
    .filter({ hasText: "Thanh Vân Sơn" })
    .getByRole("button", { name: "Tiến vào" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Thanh Vân Sơn", exact: true }),
  ).toBeVisible();
  expect((await socketRequest("inventory", "player:me")).character.map.id).toBe(
    2,
  );
  await open(page, "Thiên hạ");
  await page.getByRole("button", { name: "Rời bản đồ", exact: true }).click();
  await called(request, "map:leave");
  for (const event of [
    "inventory:use",
    "inventory:drop",
    "equipment:equip",
    "equipment:unequip",
    "skill:learn",
    "shop:buy",
    "shop:sell",
  ])
    await called(request, event);
});

test("two players manage guild membership and leadership through the UI", async ({
  browser,
  request,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "Multi-player mutation matrix runs once on desktop; mobile runs core and panel contracts.",
  );
  const { a, b, dispose } = await pair(browser, request);
  try {
    const dialog = await open(a, "Bang hội");
    await dialog.getByLabel("Tên bang hội").fill("Thanh Vân");
    await dialog.getByRole("button", { name: "Lập bang" }).click();
    await dialog.getByLabel("Mời đạo hữu").fill("Bạch Vân");
    await dialog.getByRole("button", { name: "Gửi lời mời" }).click();
    await open(b, "Bang hội");
    await b
      .locator(".online-invitation")
      .getByRole("button", { name: "Chấp nhận" })
      .click();
    await dialog.getByRole("button", { name: /Làm mới/ }).click();
    const member = dialog
      .locator(".online-card")
      .filter({ hasText: "Bạch Vân" });
    await expect(member).toBeVisible();
    await member.getByRole("button", { name: "Bổ nhiệm phó" }).click();
    await expect(member).toContainText("Phó bang");
    await member.getByRole("button", { name: "Bãi nhiệm" }).click();
    await confirm(a);
    await expect(member).toContainText("Thành viên");
    await member.getByRole("button", { name: "Nhường chức" }).click();
    await confirm(a);
    await expect(dialog.locator(".online-intro")).toContainText("Thành viên");
    await b
      .getByRole("dialog")
      .getByRole("button", { name: /Làm mới/ })
      .click();
    const oldLeader = b
      .getByRole("dialog")
      .locator(".online-card")
      .filter({ hasText: "Thanh Liên" });
    await oldLeader.getByRole("button", { name: "Trục xuất" }).click();
    await confirm(b);
    await expect(oldLeader).toHaveCount(0);
    await b.getByRole("button", { name: "Rời bang hội", exact: true }).click();
    await confirm(b);
    await expect(b.getByRole("button", { name: "Lập bang" })).toBeVisible();
    for (const event of [
      "guild:create",
      "guild:invite",
      "guild:accept",
      "guild:promote",
      "guild:demote",
      "guild:transfer",
      "guild:kick",
      "guild:leave",
    ])
      await called(request, event);
  } finally {
    await dispose();
  }
});

test("two players accept friendship, whisper, block and exchange trade offers", async ({
  browser,
  request,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "Multi-player mutation matrix runs once on desktop.",
  );
  const { a, b, dispose } = await pair(browser, request);
  try {
    let dialog = await open(a, "Đạo hữu");
    await dialog.getByLabel("Tên nhân vật", { exact: true }).fill("Bạch Vân");
    await dialog.getByRole("button", { name: "Kết bạn", exact: true }).click();
    await open(b, "Đạo hữu");
    await b
      .locator(".online-invitation")
      .getByRole("button", { name: "Chấp nhận" })
      .click();
    await expect(
      dialog.locator(".online-card").filter({ hasText: "Bạch Vân" }),
    ).toBeVisible();
    await dialog
      .getByLabel("Nội dung", { exact: true })
      .fill("Hẹn gặp dưới chân núi");
    await dialog
      .locator(".whisper-form")
      .getByRole("button", { name: "Gửi", exact: true })
      .click();
    await expect(b.locator(".online-whispers")).toContainText(
      "Hẹn gặp dưới chân núi",
    );
    await dialog
      .locator(".online-card")
      .filter({ hasText: "Bạch Vân" })
      .getByRole("button", { name: "Xóa bạn" })
      .click();
    await confirm(a);
    await dialog.getByRole("button", { name: "Chặn", exact: true }).click();
    await confirm(a);
    const blocked = dialog
      .locator(".online-card")
      .filter({ hasText: "Bạch Vân" });
    await blocked.getByRole("button", { name: "Bỏ chặn" }).click();
    await expect(blocked).toHaveCount(0);
    dialog = await open(a, "Giao dịch");
    await dialog.getByLabel("Đạo hữu muốn giao dịch").fill("Bạch Vân");
    await dialog.getByRole("button", { name: "Mời giao dịch" }).click();
    await open(b, "Giao dịch");
    await b
      .locator(".online-invitation")
      .getByRole("button", { name: "Chấp nhận" })
      .click();
    await expect(a.locator(".online-trade-sides")).toBeVisible();
    await a
      .locator(".online-offer-grid label")
      .filter({ hasText: "Hồi Huyết Đan" })
      .getByRole("spinbutton")
      .fill("2");
    await a.getByRole("button", { name: "Cập nhật đề nghị" }).click();
    await expect(b.locator(".online-trade-side").nth(1)).toContainText("×2");
    // Reopening an active trade restores its acknowledged offer, rather than an empty draft.
    await close(a);
    await open(a, "Giao dịch");
    await expect(
      a
        .locator(".online-offer-grid label")
        .filter({ hasText: "Hồi Huyết Đan" })
        .getByRole("spinbutton"),
    ).toHaveValue("2");
    await expect(
      a.getByRole("button", { name: "Xác nhận giao dịch", exact: true }),
    ).toBeEnabled();

    await b
      .locator(".online-offer-grid label")
      .filter({ hasText: "Linh Thạch" })
      .getByRole("spinbutton")
      .fill("15");
    await b.getByRole("button", { name: "Cập nhật đề nghị" }).click();
    await expect(a.locator(".online-trade-side").nth(1)).toContainText("15");
    await expect(b.locator(".online-trade-side").nth(0)).toContainText("15");
    await expect(
      b.getByRole("button", { name: "Cập nhật đề nghị" }),
    ).toBeEnabled();
    const currencyDraft = b
      .locator(".online-offer-grid label")
      .filter({ hasText: "Linh Thạch" })
      .getByRole("spinbutton");
    await currencyDraft.fill("16");

    await a
      .getByRole("button", { name: "Xác nhận giao dịch", exact: true })
      .click();
    await confirm(a);
    await expect(b.locator(".online-trade-side").nth(1)).toContainText(
      "Đã xác nhận",
    );
    // A peer's confirmation must not overwrite an unsent local draft.
    await expect(currencyDraft).toHaveValue("16");
    // A changed offer invalidates the confirmation on both browsers.
    await b
      .locator(".online-offer-grid label")
      .filter({ hasText: "Linh Thạch" })
      .getByRole("spinbutton")
      .fill("16");
    await b.getByRole("button", { name: "Cập nhật đề nghị" }).click();
    await expect(a.locator(".online-trade-side").nth(0)).toContainText(
      "Chưa xác nhận",
    );
    await expect(b.locator(".online-trade-side").nth(1)).toContainText(
      "Chưa xác nhận",
    );
    await a
      .getByRole("button", { name: "Xác nhận giao dịch", exact: true })
      .click();
    await confirm(a);
    await b
      .getByRole("button", { name: "Xác nhận giao dịch", exact: true })
      .click();
    await confirm(b);
    await expect(a.locator(".online-trade-sides")).toHaveCount(0);
    await expect(b.locator(".online-trade-sides")).toHaveCount(0);
    expect(
      (await socketRequest("first", "player:me")).character.currencies[0]
        .amount,
    ).toBe(1016);
    expect(
      (await socketRequest("second", "player:me")).character.currencies[0]
        .amount,
    ).toBe(984);
    expect(
      (await socketRequest("first", "inventory:get")).items.find(
        (item: { code: string }) => item.code === "hoi_huyet_dan",
      ).count,
    ).toBe(3);
    expect(
      (await socketRequest("second", "inventory:get")).items.find(
        (item: { code: string }) => item.code === "hoi_huyet_dan",
      ).count,
    ).toBe(7);
    await a
      .getByRole("dialog")
      .getByLabel("Đạo hữu muốn giao dịch")
      .fill("Bạch Vân");
    await a.getByRole("button", { name: "Mời giao dịch" }).click();
    await b
      .locator(".online-invitation")
      .getByRole("button", { name: "Chấp nhận" })
      .click();
    await a.getByRole("button", { name: "Hủy giao dịch", exact: true }).click();
    await expect(b.locator(".online-trade-sides")).toHaveCount(0);
    for (const event of [
      "friend:request",
      "friend:accept",
      "friend:remove",
      "block:add",
      "block:remove",
      "chat:whisper",
      "trade:request",
      "trade:accept",
      "trade:offer",
      "trade:confirm",
      "trade:cancel",
    ])
      await called(request, event);
  } finally {
    await dispose();
  }
});

test("realm breakthrough spends server experience and updates the displayed subrealm", async ({
  page,
  request,
}) => {
  await account(request, "cultivator", "Đạo Tâm");
  // Explicit fixture-only setup. The UI mutation below still uses the real wire contract.
  expect(
    (
      await request.post(`${endpoint}/__seed`, {
        data: { username: "cultivator", character: { exp: 100 } },
      })
    ).ok(),
  ).toBeTruthy();
  await login(page, "cultivator");
  await page.getByRole("button", { name: "Xem cảnh giới" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".online-cultivation")).toContainText(
    "100 / 100 tu vi",
  );
  await dialog
    .getByRole("button", { name: "Đột phá cảnh giới", exact: true })
    .click();
  await expect(dialog.locator(".online-cultivation")).toContainText(
    "Tầng 2 / 10",
  );
  await expect(dialog.locator(".online-cultivation")).toContainText(
    "0 / 100 tu vi",
  );
  const { character } = await socketRequest("cultivator", "player:me");
  expect(character.subRealm).toBe(2);
  expect(character.exp).toBe(0);
  await called(request, "cultivate:breakthrough");
});
