import assert from "node:assert/strict";
import { test } from "node:test";
import { GameClient } from "./client.ts";

const character = {
  id: 1,
  name: "DaoHuu",
  realm: { order: 1, name: "Luyện Khí" },
  subRealm: 1,
  exp: 0,
  expNeeded: 100,
  skillPoints: 0,
  currencies: [],
  map: { id: 2, x: 10, y: 20 },
  guild: null,
};
const view = {
  x: 10,
  y: 20,
  hp: 100,
  maxHp: 100,
  players: [],
  monsters: [
    { id: 3, type: "wolf", name: "Sói", x: 40, y: 40, hp: 80, maxHp: 80 },
  ],
  npcs: [{ name: "Chưởng Quầy", x: 50, y: 50 }],
};
class FakeSocket {
  connected = false;
  active = true;
  handlers = new Map();
  sent = [];
  responses = {
    "data:static": {
      realms: [{ id: 1, order: 1, name: "Luyện Khí" }],
      maps: [{ id: 2, name: "Rừng", kind: "SMALL" }],
      subRealmsPerRealm: 10,
    },
    "player:me": { character: structuredClone(character) },
    "map:join": view,
    "inventory:get": { items: [] },
    "equipment:get": { slots: {} },
    "skill:list": { points: 0, skills: [] },
    "guild:info": { guild: null },
    "friend:list": { friends: [], blocked: [] },
    "shop:list": { npc: view.npcs[0], currency: null, goods: [] },
    "shop:buy": { ok: true, spent: 1 },
  };
  on(event, callback) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), callback]);
    return this;
  }
  push(event, data) {
    for (const handler of this.handlers.get(event) ?? []) handler(data);
  }
  timeout() {
    return this;
  }
  emit(event, ...args) {
    this.sent.push({ event, args });
    const ack = args.at(-1);
    if (typeof ack !== "function") return this;
    const response = this.responses[event];
    queueMicrotask(() =>
      response instanceof Error
        ? ack(response)
        : ack(null, structuredClone(response)),
    );
    return this;
  }
  connect() {
    this.connected = true;
    queueMicrotask(() => this.push("connect"));
    return this;
  }
  disconnect() {
    this.connected = false;
    this.push("disconnect", "io client disconnect");
    return this;
  }
  removeAllListeners() {
    this.handlers.clear();
    return this;
  }
}
function setup() {
  const socket = new FakeSocket();
  const sessions = new Map();
  const storage = {
    getItem: (k) => sessions.get(k) ?? null,
    setItem: (k, v) => sessions.set(k, v),
    removeItem: (k) => sessions.delete(k),
  };
  let socketOptions;
  const client = new GameClient({
    endpoint: "http://localhost:3000",
    storage,
    timeoutMs: 50,
    socketFactory: (_endpoint, options) => {
      socketOptions = options;
      return socket;
    },
  });
  return { client, socket, sessions, options: () => socketOptions };
}

test("authenticated msgpack bootstrap resumes the saved map and loads server caches", async () => {
  const { client, socket, options, sessions } = setup();
  await client.connect("test-token");
  assert.equal(options().auth.token, "test-token");
  assert.ok(options().parser.Encoder);
  assert.equal(options().autoConnect, false);
  assert.equal(client.connected, true);
  assert.equal(client.state.world.mapId, 2);
  assert.equal(client.state.world.monsters[0].hp, 80);
  assert.equal(
    socket.sent.find((entry) => entry.event === "data:static").args.length,
    1,
    "no-payload events carry only ack",
  );
  assert.deepEqual(
    socket.sent.find((entry) => entry.event === "map:join").args[0],
    { mapId: 2 },
  );
  assert.equal(sessions.size, 1);
  client.logout();
  assert.equal(sessions.size, 0);
  assert.equal(client.state.character, null);
  assert.equal(socket.connected, false);
});

test("authoritative pushes reconcile movement, visibility, HP, death, respawn and social state", async () => {
  const { client, socket } = setup();
  await client.connect("token");
  assert.equal(client.move(20, 25), true);
  socket.push("move:rejected", { x: 10, y: 20 });
  assert.equal(client.state.world.x, 10);
  socket.push("player:joined", {
    characterId: 2,
    name: "Bạn",
    x: 30,
    y: 40,
    mapId: 2,
  });
  socket.push("player:moved", { characterId: 2, x: 50, y: 60 });
  assert.equal(client.state.world.players[0].x, 50);
  socket.push("monster:hit", {
    id: 3,
    hp: 20,
    damage: 60,
    by: 1,
    skill: "co_ban",
  });
  assert.equal(client.state.world.monsters[0].hp, 20);
  socket.push("player:hp", { hp: 0, maxHp: 100 });
  socket.push("player:died", { respawnIn: 3000 });
  assert.equal(client.move(15, 20), false);
  assert.equal(client.state.world.dead, true);
  socket.push("player:respawned", { hp: 100, maxHp: 100, x: 0, y: 0 });
  assert.equal(client.canPlay, true);
  socket.push("friend:requested", { from: "Bạn" });
  socket.push("guild:invited", { from: "Bang chủ", guildName: "Tiên Môn" });
  assert.equal(client.state.invitations.length, 2);
  socket.push("chat:message", {
    channel: "whisper",
    from: "Bạn",
    to: "DaoHuu",
    text: "Chào",
    at: 1,
  });
  assert.equal(client.state.messages[0].channel, "whisper");
  socket.push("trade:started", { with: "Bạn" });
  socket.push("trade:update", {
    me: { name: "DaoHuu", items: {}, currencies: {}, confirmed: true },
    other: {
      name: "Bạn",
      items: { herb: 2 },
      currencies: {},
      confirmed: false,
    },
  });
  assert.equal(client.state.trade.other.items.herb, 2);
  socket.push("trade:cancelled", { reason: "Đã hủy" });
  assert.equal(client.state.trade, null);
  socket.push("monster:disappeared", [3]);
  socket.push("player:left", { characterId: 2 });
  assert.equal(client.state.world.monsters.length, 0);
  assert.equal(client.state.world.players.length, 0);
  client.logout();
});

test("disconnect freezes movement; reconnect refreshes and rejoins the selected map", async () => {
  const { client, socket } = setup();
  await client.connect("token");
  await client.joinMap(7);
  socket.disconnect();
  assert.equal(client.state.status, "reconnecting");
  assert.equal(client.move(20, 20), false);
  socket.connect();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(client.connected, true);
  assert.equal(client.state.world.mapId, 7);
  assert.deepEqual(
    socket.sent.filter((entry) => entry.event === "map:join").at(-1).args[0],
    { mapId: 7 },
  );
  client.logout();
});

test("explicit map leave survives reconnect while initial connection resumes the saved map", async () => {
  const { client, socket } = setup();
  await client.connect("token");
  assert.equal(client.state.world.joined, true);
  const joins = socket.sent.filter(
    (entry) => entry.event === "map:join",
  ).length;
  client.leaveMap();
  assert.equal(client.state.world.joined, false);
  socket.disconnect();
  socket.connect();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(client.connected, true);
  assert.equal(client.state.world.joined, false);
  assert.equal(
    socket.sent.filter((entry) => entry.event === "map:join").length,
    joins,
  );
  client.logout();
});

test("server errors and acknowledgement timeout reject once without retrying mutations", async () => {
  const { client, socket } = setup();
  await client.connect("token");
  socket.responses["shop:buy"] = { error: "Không đủ tiền" };
  await assert.rejects(
    client.command("shop:buy", { code: "herb", count: 1 }),
    /Không đủ tiền/,
  );
  socket.responses["shop:buy"] = new Error("timeout");
  await assert.rejects(
    client.command("shop:buy", { code: "herb", count: 1 }),
    /chưa xác nhận/,
  );
  assert.equal(
    socket.sent.filter((entry) => entry.event === "shop:buy").length,
    2,
  );
  client.logout();
});

test("HTTP login posts real credentials and gives the resulting token to the socket", async () => {
  const socket = new FakeSocket();
  let request;
  const client = new GameClient({
    storage: null,
    socketFactory: () => socket,
    fetch: async (url, options) => {
      request = { url, options };
      return new Response(
        JSON.stringify({ token: "signed-token", username: "tester" }),
        { status: 200 },
      );
    },
  });
  await client.authenticate(
    "login",
    { account: "tester", password: "secret" },
    "https://game.example.org/",
  );
  assert.equal(request.url, "https://game.example.org/api/login");
  assert.deepEqual(JSON.parse(request.options.body), {
    account: "tester",
    password: "secret",
  });
  assert.equal(client.state.username, "tester");
  assert.equal(client.state.endpoint, "https://game.example.org");
  client.logout();
});

test("character creation remains successful when an optional panel read fails", async () => {
  const { client, socket } = setup();
  socket.responses["player:me"] = { character: null };
  await client.connect("token");
  socket.responses["character:create"] = { character };
  socket.responses["inventory:get"] = { error: "Không tải được túi" };
  const created = await client.createCharacter("DaoHuu");
  assert.equal(created.id, 1);
  assert.equal(client.state.character.id, 1);
  assert.equal(
    socket.sent.filter((entry) => entry.event === "character:create").length,
    1,
  );
  assert.equal(client.state.notifications.at(-1).event, "refresh:error");
  client.logout();
});

test("combat subscriptions return a disposer and survive reconnect", async () => {
  const { client, socket } = setup();
  let hits = 0;
  const unsubscribe = client.subscribe("monster:hit", () => {
    hits += 1;
  });
  await client.connect("token");
  const hit = { id: 3, hp: 70, damage: 10, by: 1, skill: "co_ban" };
  socket.push("monster:hit", hit);
  socket.disconnect();
  socket.connect();
  await new Promise((resolve) => setImmediate(resolve));
  socket.push("monster:hit", hit);
  unsubscribe();
  socket.push("monster:hit", hit);
  assert.equal(hits, 2);
  client.logout();
});

test("HTTPS pages reject remote HTTP backends before sending credentials", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { protocol: "https:" },
  });
  try {
    const client = new GameClient({
      storage: null,
      fetch: () => {
        throw new Error("HTTP should not run");
      },
    });
    await assert.rejects(
      client.authenticate(
        "login",
        { account: "tester", password: "secret" },
        "http://game.example.org",
      ),
      /máy chủ HTTPS/,
    );
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "location", descriptor);
    else delete globalThis.location;
  }
});
