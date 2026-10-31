/** In-memory HTTP/Socket.IO CONTRACT FIXTURE. This is not the Prisma backend. */
import http from "node:http";
import { createRequire } from "node:module";
const require = createRequire(new URL("../../package.json", import.meta.url));
const { Server } = require("socket.io");
const parser = require("socket.io-msgpack-parser");
const accounts = new Map(),
  tokens = new Map(),
  calls = [];
let nextId = 1;
const clone = (value) => JSON.parse(JSON.stringify(value));
const blankSlots = () => ({
  WEAPON: null,
  ARMOR: null,
  HELMET: null,
  BOOTS: null,
  RING: null,
});
const baseItem = {
  code: "thiet_kiem",
  name: "Thiết Kiếm",
  quality: "COMMON",
  atkBonus: 5,
  hpBonus: 0,
  count: 1,
  healHp: 0,
  expGain: 0,
  slot: "WEAPON",
};
const potion = {
  ...baseItem,
  code: "hoi_huyet_dan",
  name: "Hồi Huyết Đan",
  atkBonus: 0,
  count: 5,
  healHp: 30,
  slot: null,
};
const staticData = {
  realms: [
    { id: 1, order: 1, name: "Luyện Khí" },
    { id: 2, order: 2, name: "Trúc Cơ" },
  ],
  maps: [
    { id: 1, name: "Thanh Vân Thôn", kind: "SMALL" },
    { id: 2, name: "Thanh Vân Sơn", kind: "LARGE" },
  ],
  subRealmsPerRealm: 10,
};
const npc = { name: "Thương Nhân", x: 50, y: 50 };
const makeMonster = () => ({
  id: 1,
  type: "wolf",
  name: "Sói Hoang",
  hp: 20,
  maxHp: 20,
  x: 100,
  y: 0,
});
const skills = (account) => ({
  points: account.character?.skillPoints ?? 0,
  skills: [
    {
      code: "co_ban",
      name: "Cơ Bản",
      damageMult: 1,
      range: 200,
      cooldownMs: 0,
      minRealm: 1,
      cost: 0,
      learned: true,
      canLearn: false,
    },
    {
      code: "hoa_cau",
      name: "Hỏa Cầu",
      damageMult: 2,
      range: 300,
      cooldownMs: 100,
      minRealm: 1,
      cost: 1,
      learned: account.learned,
      canLearn: !account.learned && (account.character?.skillPoints ?? 0) > 0,
    },
  ],
});
const shop = {
  npc,
  currency: { code: "linh_thach", name: "Linh Thạch" },
  goods: [baseItem, potion].map((item) => ({
    code: item.code,
    name: item.name,
    price: 10,
    sellPrice: 5,
  })),
};
async function body(req) {
  let text = "";
  for await (const chunk of req) text += chunk;
  return text ? JSON.parse(text) : {};
}
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  const send = (status, data) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  if (req.method === "OPTIONS") return send(204, {});
  try {
    if (req.url === "/health") return send(200, { fixture: true });
    if (req.url === "/__state" && req.method === "GET")
      return send(
        200,
        [...accounts.values()].map((a) => ({
          username: a.username,
          character: a.character,
          inventory: a.inventory,
          equipment: a.equipment,
          learned: a.learned,
          guild: a.guild,
          friends: a.friends,
          blocked: a.blocked,
          trade: a.trade ?? null,
        })),
      );
    if (req.url === "/__seed" && req.method === "POST") {
      const data = await body(req);
      const account = accounts.get(data.username);
      if (
        !account?.character ||
        !Number.isInteger(data.character?.exp) ||
        data.character.exp < 0 ||
        Object.keys(data).some((k) => !["username", "character"].includes(k)) ||
        Object.keys(data.character).some((k) => k !== "exp")
      )
        return send(400, {
          error: "Fixture seed accepts existing character exp only",
        });
      account.character.exp = data.character.exp;
      return send(200, { ok: true });
    }
    if (req.url === "/__calls" && req.method === "GET") return send(200, calls);
    if (req.url === "/__reset" && req.method === "POST") {
      io.disconnectSockets(true);
      accounts.clear();
      tokens.clear();
      calls.length = 0;
      nextId = 1;
      return send(200, { ok: true });
    }
    if (req.url === "/__push" && req.method === "POST") {
      const { event, payload, username } = await body(req);
      for (const socket of io.sockets.sockets.values())
        if (!username || socket.data.account.username === username)
          socket.emit(event, payload);
      return send(200, { ok: true });
    }
    if (
      req.method !== "POST" ||
      !["/api/register", "/api/login"].includes(req.url)
    )
      return send(404, { error: "Not found" });
    const data = await body(req);
    calls.push(req.url.slice(5));
    let account;
    if (req.url === "/api/register") {
      if (
        !data.email ||
        !data.username ||
        typeof data.password !== "string" ||
        data.password.length < 6
      )
        return send(400, { error: "Thông tin đăng ký không hợp lệ" });
      if (
        [...accounts.values()].some(
          (a) =>
            a.email === data.email.toLowerCase() ||
            a.username === data.username,
        )
      )
        return send(409, { error: "Tài khoản đã tồn tại" });
      account = {
        email: data.email.toLowerCase(),
        username: data.username,
        password: data.password,
        character: null,
        inventory: [clone(baseItem), clone(potion)],
        equipment: blankSlots(),
        learned: false,
        guild: null,
        friends: [],
        blocked: [],
        monster: makeMonster(),
      };
      accounts.set(account.username, account);
    } else {
      account = [...accounts.values()].find(
        (a) =>
          a.email === String(data.account).toLowerCase() ||
          a.username === data.account,
      );
      if (!account || account.password !== data.password)
        return send(401, { error: "Sai tài khoản hoặc mật khẩu" });
    }
    const token = `fixture-token-${account.username}`;
    tokens.set(token, account);
    return send(req.url === "/api/register" ? 201 : 200, {
      token,
      username: account.username,
    });
  } catch {
    send(400, { error: "Invalid fixture request" });
  }
});
const io = new Server(server, { parser, cors: { origin: "*" } });
io.use((socket, next) => {
  const account = tokens.get(socket.handshake.auth.token);
  if (!account) return next(new Error("unauthorized"));
  socket.data.account = account;
  next();
});
const socketsFor = (name) =>
  [...io.sockets.sockets.values()].filter(
    (s) => s.data.account.character?.name === name,
  );
const notify = (name, event, payload) =>
  socketsFor(name).forEach((s) => s.emit(event, payload));
const player = (a) => ({
  characterId: a.character.id,
  name: a.character.name,
  mapId: a.character.map.id,
  x: a.character.map.x,
  y: a.character.map.y,
});
const accountByCharacter = (name) =>
  [...accounts.values()].find((account) => account.character?.name === name);
const hasAssets = (account, side) =>
  Object.entries(side.items).every(
    ([code, count]) =>
      (account.inventory.find((i) => i.code === code)?.count ?? 0) >= count,
  ) &&
  Object.entries(side.currencies).every(
    ([code, amount]) =>
      (account.character.currencies.find((c) => c.code === code)?.amount ??
        0) >= amount,
  );
function transferAssets(from, to, side) {
  for (const [code, count] of Object.entries(side.items)) {
    const item = from.inventory.find((i) => i.code === code);
    item.count -= count;
    let target = to.inventory.find((i) => i.code === code);
    if (!target) {
      target = { ...item, count: 0 };
      to.inventory.push(target);
    }
    target.count += count;
  }
  for (const [code, amount] of Object.entries(side.currencies)) {
    const currency = from.character.currencies.find((c) => c.code === code);
    currency.amount -= amount;
    let target = to.character.currencies.find((c) => c.code === code);
    if (!target) {
      target = { ...currency, amount: 0 };
      to.character.currencies.push(target);
    }
    target.amount += amount;
  }
}
io.on("connection", (socket) => {
  const a = socket.data.account;
  const handlers = {
    "data:static": () => staticData,
    "player:me": () => ({ character: a.character }),
    "character:create": ({ name }) => {
      if (a.character) return { error: "Đã có nhân vật" };
      if (
        !name?.trim() ||
        [...accounts.values()].some((x) => x.character?.name === name)
      )
        return { error: "Tên nhân vật không hợp lệ hoặc đã tồn tại" };
      a.character = {
        id: nextId++,
        name,
        realm: { order: 1, name: "Luyện Khí" },
        subRealm: 1,
        exp: 0,
        expNeeded: 100,
        skillPoints: 3,
        currencies: [{ code: "linh_thach", name: "Linh Thạch", amount: 1000 }],
        map: null,
        guild: null,
      };
      return { character: a.character };
    },
    "map:join": (data = {}) => {
      if (!a.character) return { error: "Chưa tạo nhân vật" };
      const mapId = data.mapId ?? a.character.map?.id;
      if (!staticData.maps.some((m) => m.id === mapId))
        return { error: "Chưa chọn map" };
      if (socket.data.joined && a.character.map?.id !== mapId) {
        socket
          .to(`map:${a.character.map.id}`)
          .emit("player:left", { characterId: a.character.id });
        socket.leave(`map:${a.character.map.id}`);
      }
      a.character.map = {
        id: mapId,
        x: a.character.map?.id === mapId ? a.character.map.x : 0,
        y: a.character.map?.id === mapId ? a.character.map.y : 0,
      };
      socket.join(`map:${mapId}`);
      socket.data.joined = true;
      socket.to(`map:${mapId}`).emit("player:joined", player(a));
      return {
        x: a.character.map.x,
        y: a.character.map.y,
        hp: 100,
        maxHp: 100,
        players: [...io.sockets.sockets.values()]
          .filter(
            (s) =>
              s !== socket &&
              s.data.joined &&
              s.data.account.character?.map?.id === mapId,
          )
          .map((s) => player(s.data.account)),
        monsters: a.monster.hp > 0 ? [a.monster] : [],
        npcs: [npc],
      };
    },
    "chat:send": (data) => {
      io.emit("chat:message", {
        ...data,
        from: a.character.name,
        at: Date.now(),
      });
      return { ok: true };
    },
    "chat:whisper": (data) => {
      const msg = {
        channel: "whisper",
        from: a.character.name,
        to: data.to,
        text: data.text,
        at: Date.now(),
      };
      socket.emit("chat:message", msg);
      notify(data.to, "chat:message", msg);
      return { ok: true };
    },
    "skill:list": () => skills(a),
    "skill:learn": ({ code }) => {
      if (code !== "hoa_cau" || a.learned || a.character.skillPoints < 1)
        return { error: "Không thể học kỹ năng" };
      a.learned = true;
      return { ok: true, points: --a.character.skillPoints };
    },
    cast: ({ targetId, skill = "co_ban" }) => {
      if (targetId !== a.monster.id || a.monster.hp <= 0)
        return { error: "Không có mục tiêu" };
      const damage = skill === "hoa_cau" ? 20 : 10;
      a.monster.hp = Math.max(0, a.monster.hp - damage);
      socket.emit("monster:hit", {
        id: targetId,
        hp: a.monster.hp,
        damage,
        by: a.character.id,
        skill,
      });
      if (!a.monster.hp) {
        a.character.exp += 20;
        a.character.currencies[0].amount += 5;
        a.inventory.find((i) => i.code === potion.code).count++;
        socket.emit("monster:disappeared", [targetId]);
        socket.emit("player:loot", {
          exp: 20,
          currencies: [{ code: "linh_thach", name: "Linh Thạch", amount: 5 }],
          items: [
            {
              code: potion.code,
              name: potion.name,
              quality: "COMMON",
              count: 1,
            },
          ],
        });
        socket.emit("player:exp", { exp: a.character.exp, expNeeded: 100 });
      }
      return { damage, hp: a.monster.hp, killed: !a.monster.hp, typeId: 1 };
    },
    "inventory:get": () => ({ items: a.inventory.filter((i) => i.count > 0) }),
    "inventory:use": ({ code }) => {
      const item = a.inventory.find((i) => i.code === code);
      if (!item?.count) return { error: "Không có vật phẩm" };
      item.count--;
      socket.emit("player:hp", { hp: 100, maxHp: 100 });
      return { ok: true };
    },
    "inventory:drop": ({ code, count }) => {
      const item = a.inventory.find((i) => i.code === code);
      if (!item || count < 1 || item.count < count)
        return { error: "Không đủ vật phẩm" };
      item.count -= count;
      return { ok: true };
    },
    "equipment:get": () => ({ slots: a.equipment }),
    "equipment:equip": ({ code }) => {
      const item = a.inventory.find((i) => i.code === code);
      if (!item?.slot || !item.count) return { error: "Không thể trang bị" };
      a.equipment[item.slot] = item;
      return { slots: a.equipment };
    },
    "equipment:unequip": ({ slot }) => {
      a.equipment[slot] = null;
      return { slots: a.equipment };
    },
    "guild:info": () => ({ guild: a.guild }),
    "guild:create": ({ name }) => {
      a.guild = {
        id: nextId++,
        name,
        leader: a.character.name,
        members: [{ name: a.character.name, online: true, role: "LEADER" }],
      };
      a.character.guild = { id: a.guild.id, name };
      return { guild: a.guild };
    },
    "guild:invite": ({ name }) => {
      if (!a.guild) return { error: "Chưa ở trong bang" };
      for (const target of socketsFor(name)) {
        target.data.account.invitedGuild = a.guild;
        target.emit("guild:invited", {
          from: a.character.name,
          guildName: a.guild.name,
        });
      }
      return { ok: true };
    },
    "guild:accept": () => {
      if (!a.invitedGuild) return { error: "Không có lời mời hợp lệ" };
      a.guild = a.invitedGuild;
      a.guild.members.push({
        name: a.character.name,
        online: true,
        role: "MEMBER",
      });
      a.character.guild = { id: a.guild.id, name: a.guild.name };
      return { guild: a.guild };
    },
    "guild:leave": () => {
      if (a.guild)
        a.guild.members = a.guild.members.filter(
          (m) => m.name !== a.character.name,
        );
      a.guild = null;
      a.character.guild = null;
      return { ok: true };
    },
    "guild:kick": ({ name }) => {
      if (a.guild)
        a.guild.members = a.guild.members.filter((m) => m.name !== name);
      return { ok: true };
    },
    "guild:transfer": ({ name }) => {
      if (a.guild) {
        a.guild.leader = name;
        a.guild.members.forEach((m) => {
          m.role = m.name === name ? "LEADER" : "MEMBER";
        });
      }
      return { guild: a.guild };
    },
    "guild:promote": ({ name }) => {
      const member = a.guild?.members.find((m) => m.name === name);
      if (member) member.role = "DEPUTY";
      return { guild: a.guild };
    },
    "guild:demote": ({ name }) => {
      const member = a.guild?.members.find((m) => m.name === name);
      if (member) member.role = "MEMBER";
      return { guild: a.guild };
    },
    "friend:list": () => ({
      friends: a.friends.map((name) => ({
        name,
        online: socketsFor(name).length > 0,
      })),
      blocked: a.blocked,
    }),
    "friend:request": ({ name }) => {
      notify(name, "friend:requested", { from: a.character.name });
      return { ok: true };
    },
    "friend:accept": ({ name }) => {
      if (!a.friends.includes(name)) a.friends.push(name);
      for (const target of socketsFor(name)) {
        if (!target.data.account.friends.includes(a.character.name))
          target.data.account.friends.push(a.character.name);
        target.emit("friend:added", { name: a.character.name });
      }
      socket.emit("friend:added", { name });
      return { ok: true };
    },
    "friend:remove": ({ name }) => {
      a.friends = a.friends.filter((n) => n !== name);
      return { ok: true };
    },
    "block:add": ({ name }) => {
      if (!a.blocked.includes(name)) a.blocked.push(name);
      return { ok: true };
    },
    "block:remove": ({ name }) => {
      a.blocked = a.blocked.filter((n) => n !== name);
      return { ok: true };
    },
    "trade:request": ({ name }) => {
      for (const target of socketsFor(name)) {
        target.data.account.tradeFrom = a.character.name;
        target.emit("trade:requested", { from: a.character.name });
      }
      return { ok: true };
    },
    "trade:accept": () => {
      const other = a.tradeFrom;
      if (!other) return { error: "Không có lời mời hợp lệ" };
      const side = (name) => ({
        name,
        items: {},
        currencies: {},
        confirmed: false,
      });
      a.trade = { me: side(a.character.name), other: side(other) };
      socket.emit("trade:started", { with: other });
      for (const target of socketsFor(other)) {
        target.data.account.trade = {
          me: side(other),
          other: side(a.character.name),
        };
        target.emit("trade:started", { with: a.character.name });
      }
      return { ok: true };
    },
    "trade:offer": (data) => {
      if (!a.trade) return { error: "Chưa giao dịch" };
      if (
        !Array.isArray(data.items) ||
        !Array.isArray(data.currencies) ||
        data.items.some((i) => !Number.isInteger(i.count) || i.count < 1) ||
        data.currencies.some((c) => !Number.isInteger(c.amount) || c.amount < 1)
      )
        return { error: "Đề nghị không hợp lệ" };
      const items = Object.fromEntries(
          data.items.map((i) => [i.code, i.count]),
        ),
        currencies = Object.fromEntries(
          data.currencies.map((c) => [c.code, c.amount]),
        );
      if (!hasAssets(a, { items, currencies }))
        return { error: "Không đủ tài sản" };
      a.trade.me.items = items;
      a.trade.me.currencies = currencies;
      a.trade.me.confirmed = false;
      a.trade.other.confirmed = false;
      const other = accountByCharacter(a.trade.other.name);
      if (other?.trade) {
        other.trade.other = clone(a.trade.me);
        other.trade.me.confirmed = false;
        notify(other.character.name, "trade:update", other.trade);
      }
      socket.emit("trade:update", a.trade);
      return { ok: true };
    },
    "trade:confirm": () => {
      if (!a.trade) return { error: "Chưa giao dịch" };
      const other = accountByCharacter(a.trade.other.name);
      if (!other?.trade) return { error: "Người chơi đã ngắt giao dịch" };
      if (!hasAssets(a, a.trade.me) || !hasAssets(other, other.trade.me))
        return { error: "Không đủ tài sản" };
      a.trade.me.confirmed = true;
      other.trade.other.confirmed = true;
      if (other.trade.me.confirmed) {
        transferAssets(a, other, a.trade.me);
        transferAssets(other, a, other.trade.me);
        a.trade = null;
        other.trade = null;
        socket.emit("trade:completed");
        notify(other.character.name, "trade:completed");
      } else {
        socket.emit("trade:update", a.trade);
        notify(other.character.name, "trade:update", other.trade);
      }
      return { ok: true };
    },
    "trade:cancel": () => {
      const other = a.trade && accountByCharacter(a.trade.other.name);
      if (other) {
        other.trade = null;
        notify(other.character.name, "trade:cancelled", {
          reason: "Đã hủy giao dịch",
        });
      }
      a.trade = null;
      socket.emit("trade:cancelled", { reason: "Đã hủy giao dịch" });
      return { ok: true };
    },
    "shop:list": () => shop,
    "shop:buy": ({ code, count }) => {
      if (
        !Number.isInteger(count) ||
        count < 1 ||
        !shop.goods.some((i) => i.code === code)
      )
        return { error: "Không hợp lệ" };
      const spent = count * 10;
      if (a.character.currencies[0].amount < spent)
        return { error: "Không đủ tiền" };
      a.character.currencies[0].amount -= spent;
      a.inventory.find((i) => i.code === code).count += count;
      return { ok: true, spent };
    },
    "shop:sell": ({ code, count }) => {
      const item = a.inventory.find((i) => i.code === code);
      if (!Number.isInteger(count) || count < 1 || !item || item.count < count)
        return { error: "Không đủ vật phẩm" };
      item.count -= count;
      const earned = count * 5;
      a.character.currencies[0].amount += earned;
      return { ok: true, earned };
    },
    "cultivate:breakthrough": () => {
      if (a.character.exp < a.character.expNeeded)
        return { error: "Chưa đủ tu vi" };
      a.character.exp = 0;
      a.character.subRealm++;
      return { character: a.character };
    },
  };
  for (const [event, handler] of Object.entries(handlers))
    socket.on(event, (...args) => {
      calls.push(event);
      const ack = typeof args.at(-1) === "function" ? args.pop() : () => {};
      try {
        ack(clone(handler(...args)));
      } catch {
        ack({ error: "Fixture operation invalid in current state" });
      }
    });
  socket.on("move", (data) => {
    calls.push("move");
    if (!socket.data.joined || !a.character?.map) return;
    Object.assign(a.character.map, data);
    socket
      .to(`map:${a.character.map.id}`)
      .emit("player:moved", { characterId: a.character.id, ...data });
  });
  const leave = () => {
    if (socket.data.joined && a.character?.map) {
      socket
        .to(`map:${a.character.map.id}`)
        .emit("player:left", { characterId: a.character.id });
      socket.leave(`map:${a.character.map.id}`);
    }
    socket.data.joined = false;
  };
  socket.on("map:leave", () => {
    calls.push("map:leave");
    leave();
  });
  socket.on("disconnect", leave);
});
server.listen(4351, "127.0.0.1", () =>
  console.log(
    "Contract fixture listening at http://127.0.0.1:4351 (not the Prisma backend)",
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => io.close(() => server.close(() => process.exit(0))));
