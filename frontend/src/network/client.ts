import { reactive } from "vue";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import parser from "socket.io-msgpack-parser";
import type {
  Character,
  ChatMessage,
  CombatEvents,
  GameState,
  Guild,
  Invitation,
  Loot,
  MapView,
  Monster,
  RequestArgs,
  RequestEvent,
  Requests,
  Slots,
  TradeView,
  WorldPlayer,
} from "./types.ts";

export * from "./types.ts";

const SESSION_KEY = "tien-linh-gioi-session";
export const DEFAULT_BACKEND_URL =
  import.meta.env?.VITE_BACKEND_URL?.trim() ?? "";

function initialState(endpoint: string): GameState {
  return {
    status: "idle",
    error: null,
    endpoint,
    username: "",
    character: null,
    staticData: { realms: [], maps: [], subRealmsPerRealm: 10 },
    world: {
      mapId: null,
      joined: false,
      dead: false,
      respawnAt: null,
      x: 0,
      y: 0,
      hp: 0,
      maxHp: 0,
      players: [],
      monsters: [],
      npcs: [],
    },
    messages: [],
    invitations: [],
    notifications: [],
    trade: null,
    inventory: [],
    equipment: {
      WEAPON: null,
      ARMOR: null,
      HELMET: null,
      BOOTS: null,
      RING: null,
    },
    skills: { points: 0, skills: [] },
    guild: null,
    friends: { friends: [], blocked: [] },
    shop: null,
    lastLoot: null,
  };
}

export interface ClientOptions {
  endpoint?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  socketFactory?: typeof io;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
}
export type LoginCredentials = { account: string; password: string };
export type RegisterCredentials = {
  email: string;
  username: string;
  password: string;
};

/** Backend acknowledgements are requested once. A timeout never retries a mutation. */
export class GameClient {
  readonly state: GameState;
  private socket: Socket | null = null;
  private token = "";
  // Undefined means no explicit choice yet; null records an explicit map leave.
  private wantedMapId: number | null | undefined = undefined;
  private nextId = 1;
  private readonly subscriptions = new Map<
    keyof CombatEvents,
    Set<(payload: unknown) => void>
  >();
  private readonly timeoutMs: number;
  private readonly fetcher: typeof fetch;
  private readonly socketFactory: typeof io;
  private readonly storage: ClientOptions["storage"];

  constructor(options: ClientOptions = {}) {
    this.state = reactive(
      initialState(options.endpoint ?? DEFAULT_BACKEND_URL),
    );
    this.timeoutMs = options.timeoutMs ?? 12000;
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.socketFactory = options.socketFactory ?? io;
    let storage: ClientOptions["storage"] = options.storage;
    if (storage === undefined) {
      try {
        storage = globalThis.sessionStorage ?? null;
      } catch {
        storage = null;
      }
    }
    this.storage = storage;
  }

  get connected() {
    return this.state.status === "connected";
  }
  get canPlay() {
    return this.connected && this.state.world.joined && !this.state.world.dead;
  }

  /** Effects subscriptions survive transport reconnection. Dispose them when the view unmounts. */
  on<E extends keyof CombatEvents>(
    event: E,
    callback: (payload: CombatEvents[E]) => void,
  ): () => void {
    const handlers =
      this.subscriptions.get(event) ?? new Set<(payload: unknown) => void>();
    this.subscriptions.set(event, handlers);
    const handler = (payload: unknown) => callback(payload as CombatEvents[E]);
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  }

  subscribe<E extends keyof CombatEvents>(
    event: E,
    callback: (payload: CombatEvents[E]) => void,
  ): () => void {
    return this.on(event, callback);
  }

  private fail(error: unknown): Error {
    const result = error instanceof Error ? error : new Error(String(error));
    this.state.error = result.message;
    return result;
  }

  private endpoint(value = this.state.endpoint): string {
    if (!value.trim())
      throw this.fail(new Error("Chưa cấu hình địa chỉ máy chủ."));
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw this.fail(new Error("Địa chỉ máy chủ không hợp lệ."));
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw this.fail(
        new Error("Địa chỉ máy chủ phải là URL HTTP hoặc HTTPS."),
      );
    }
    if (
      globalThis.location?.protocol === "https:" &&
      url.protocol === "http:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    ) {
      throw this.fail(
        new Error("Trang HTTPS cần máy chủ HTTPS để kết nối an toàn."),
      );
    }
    return url.href.replace(/\/$/, "");
  }

  private saveSession() {
    try {
      this.storage?.setItem(
        SESSION_KEY,
        JSON.stringify({
          token: this.token,
          username: this.state.username,
          endpoint: this.state.endpoint,
        }),
      );
    } catch {
      /* Storage may be unavailable in private browsing. */
    }
  }

  async restoreSession(): Promise<boolean> {
    let saved: { token?: string; username?: string; endpoint?: string } | null =
      null;
    try {
      saved = JSON.parse(this.storage?.getItem(SESSION_KEY) ?? "null");
    } catch {
      return false;
    }
    if (
      !saved?.token ||
      !saved.endpoint ||
      (this.state.endpoint && this.endpoint() !== saved.endpoint)
    )
      return false;
    this.state.username = saved.username ?? "";
    await this.connect(saved.token, saved.endpoint);
    return true;
  }

  async authenticate(
    mode: "login" | "register",
    credentials: LoginCredentials | RegisterCredentials,
    endpoint?: string,
  ) {
    const address = this.endpoint(endpoint);
    this.logout();
    this.state.endpoint = address;
    this.state.status = "authenticating";
    this.state.error = null;
    try {
      const response = await this.fetcher(`${address}/api/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const data = (await response.json()) as {
        token?: string;
        username?: string;
        error?: string;
      };
      if (!response.ok || !data.token || !data.username)
        throw new Error(data.error ?? "Đăng nhập thất bại.");
      this.state.username = data.username;
      await this.connect(data.token, address);
    } catch (error) {
      this.state.status = "error";
      throw this.fail(error);
    }
  }

  async connect(token = this.token, endpoint?: string): Promise<void> {
    const address = this.endpoint(endpoint);
    if (!token) throw this.fail(new Error("Vui lòng đăng nhập."));
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.token = token;
    this.state.endpoint = address;
    this.state.status = "connecting";
    this.state.error = null;
    const socket = this.socketFactory(address, {
      autoConnect: false,
      parser,
      auth: { token },
      reconnection: true,
      timeout: this.timeoutMs,
    });
    this.socket = socket;
    this.bindPushes(socket);
    socket.on("disconnect", (reason: string) => {
      this.state.status =
        reason === "io server disconnect" ? "error" : "reconnecting";
      this.state.error = "Mất kết nối máy chủ. Thao tác đã tạm dừng.";
      this.state.world.joined = false;
      this.state.world.players = [];
      this.state.world.monsters = [];
      this.state.trade = null;
      this.state.invitations = [];
    });
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.state.status = "error";
        reject(this.fail(new Error("Kết nối máy chủ quá thời gian chờ.")));
      }, this.timeoutMs);
      socket.on("connect_error", (error: Error) => {
        this.state.status = socket.active ? "reconnecting" : "error";
        this.fail(error);
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(error);
        }
        if (error.message === "unauthorized") {
          this.token = "";
          try {
            this.storage?.removeItem(SESSION_KEY);
          } catch {
            /* unavailable storage */
          }
        }
      });
      socket.on("connect", async () => {
        try {
          this.state.status = "connecting";
          await Promise.all([
            this.request("data:static"),
            this.refreshCharacter(),
          ]);
          if (socket !== this.socket || !socket.connected) return;
          if (this.state.character) {
            const mapId =
              this.wantedMapId === undefined
                ? this.state.character.map?.id
                : this.wantedMapId;
            if (mapId !== undefined && mapId !== null)
              await this.joinMap(mapId);
            await this.refreshPanelsBestEffort();
          }
          if (socket !== this.socket || !socket.connected) return;
          this.state.status = "connected";
          this.state.error = null;
          this.saveSession();
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve();
          }
        } catch (error) {
          this.state.status = "error";
          this.fail(error);
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(error);
          }
        }
      });
      socket.connect();
    });
  }

  async request<E extends RequestEvent>(
    event: E,
    ...args: RequestArgs<E>
  ): Promise<Requests[E][1]> {
    const socket = this.socket;
    if (!socket?.connected) throw this.fail(new Error("Chưa kết nối máy chủ."));
    const payload = args[0];
    return new Promise<Requests[E][1]>((resolve, reject) => {
      const ack = (
        error: Error | null,
        response: Requests[E][1] | { error: string },
      ) => {
        if (error)
          return reject(
            this.fail(
              new Error(
                "Máy chủ chưa xác nhận thao tác. Hãy kiểm tra trạng thái trước khi thử lại.",
              ),
            ),
          );
        if (socket !== this.socket || !socket.connected)
          return reject(this.fail(new Error("Kết nối đã thay đổi.")));
        if (!response || typeof response !== "object")
          return reject(this.fail(new Error("Phản hồi máy chủ không hợp lệ.")));
        if ("error" in response)
          return reject(this.fail(new Error(response.error)));
        this.applyAck(event, response);
        resolve(response);
      };
      if (payload === undefined)
        socket.timeout(this.timeoutMs).emit(event, ack);
      else socket.timeout(this.timeoutMs).emit(event, payload, ack);
    });
  }

  async command<E extends RequestEvent>(
    event: E,
    ...args: RequestArgs<E>
  ): Promise<Requests[E][1]> {
    const result = await this.request(event, ...args);
    const refresh: Promise<unknown>[] = [];
    if (
      /^(inventory:(use|drop)|equipment:(equip|unequip)|shop:(buy|sell))$/.test(
        event,
      )
    ) {
      refresh.push(this.request("inventory:get"), this.refreshCharacter());
    }
    if (event === "skill:learn" || event === "cultivate:breakthrough")
      refresh.push(this.request("skill:list"), this.refreshCharacter());
    if (/^(friend:(accept|remove)|block:)/.test(event))
      refresh.push(this.request("friend:list"));
    if (
      /^guild:(create|accept|leave|kick|transfer|promote|demote)$/.test(event)
    )
      refresh.push(this.request("guild:info"), this.refreshCharacter());
    if (event === "friend:accept")
      this.dismissInvitation("friend", (args[0] as { name: string }).name);
    if (event === "guild:accept") this.dismissInvitation("guild");
    if (event === "trade:accept") this.dismissInvitation("trade");
    // A refresh failure must not report a successful mutation as failed or encourage retrying it.
    const outcomes = await Promise.allSettled(refresh);
    if (outcomes.some((outcome) => outcome.status === "rejected"))
      this.notify(
        "refresh:error",
        "Thao tác đã hoàn tất; chưa thể tải lại toàn bộ dữ liệu.",
      );
    return result;
  }

  async refreshCharacter(): Promise<Character | null> {
    return (await this.request("player:me")).character;
  }

  async refreshPanels() {
    await Promise.all([
      this.request("inventory:get"),
      this.request("equipment:get"),
      this.request("skill:list"),
      this.request("guild:info"),
      this.request("friend:list"),
      this.request("shop:list"),
    ]);
  }

  private async refreshPanelsBestEffort() {
    try {
      await this.refreshPanels();
    } catch {
      this.notify(
        "refresh:error",
        "Đã kết nối; chưa thể tải lại toàn bộ dữ liệu.",
      );
    }
  }

  async createCharacter(name: string) {
    const result = await this.request("character:create", { name });
    await this.refreshPanelsBestEffort();
    return result.character;
  }

  async joinMap(mapId?: number) {
    const view = await this.request(
      "map:join",
      mapId === undefined ? undefined : { mapId },
    );
    this.wantedMapId = mapId ?? this.state.character?.map?.id ?? null;
    this.state.world.mapId = this.wantedMapId;
    if (this.state.character && this.wantedMapId !== null)
      this.state.character.map = { id: this.wantedMapId, x: view.x, y: view.y };
    return view;
  }

  leaveMap() {
    if (!this.socket?.connected) return;
    this.socket.emit("map:leave");
    this.wantedMapId = null;
    this.state.world.joined = false;
    this.state.world.players = [];
    this.state.world.monsters = [];
  }

  move(x: number, y: number): boolean {
    if (!this.canPlay || !Number.isFinite(x) || !Number.isFinite(y))
      return false;
    this.socket!.emit("move", { x, y });
    Object.assign(this.state.world, { x, y });
    return true;
  }

  async cast(targetId: number, skill = "co_ban") {
    if (!this.canPlay)
      throw this.fail(new Error("Cần ở trong map và còn sống."));
    return this.request("cast", { targetId, skill });
  }

  dismissInvitation(kind: Invitation["kind"], from?: string) {
    this.state.invitations = this.state.invitations.filter(
      (invite) =>
        invite.kind !== kind || (from !== undefined && invite.from !== from),
    );
  }

  logout() {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.token = "";
    this.wantedMapId = undefined;
    try {
      this.storage?.removeItem(SESSION_KEY);
    } catch {
      /* unavailable storage */
    }
    Object.assign(this.state, initialState(this.state.endpoint));
  }

  private applyAck(event: RequestEvent, response: object) {
    if (event === "data:static")
      this.state.staticData = response as Requests["data:static"][1];
    if ("character" in response) {
      this.state.character = (
        response as { character: Character | null }
      ).character;
      if (this.state.character)
        this.state.skills.points = this.state.character.skillPoints;
    }
    if (event === "map:join")
      Object.assign(this.state.world, response as MapView, {
        joined: true,
        dead: false,
        respawnAt: null,
      });
    if (event === "inventory:get")
      this.state.inventory = (response as Requests["inventory:get"][1]).items;
    if ("slots" in response)
      this.state.equipment = (response as { slots: Slots }).slots;
    if (event === "skill:list")
      this.state.skills = response as Requests["skill:list"][1];
    if ("guild" in response)
      this.state.guild = (response as { guild: Guild | null }).guild;
    if (event === "friend:list")
      this.state.friends = response as Requests["friend:list"][1];
    if (event === "shop:list")
      this.state.shop = response as Requests["shop:list"][1];
  }

  private notify(event: string, text: string) {
    this.state.notifications.push({
      id: this.nextId++,
      event,
      text,
      at: Date.now(),
    });
    if (this.state.notifications.length > 100) this.state.notifications.shift();
  }

  private background(task: Promise<unknown>) {
    void task.catch((error: unknown) => this.fail(error));
  }

  private bindPushes(socket: Socket) {
    for (const event of [
      "monster:hit",
      "monster:attack",
      "player:loot",
    ] as const) {
      socket.on(event, (payload: CombatEvents[typeof event]) => {
        for (const handler of this.subscriptions.get(event) ?? [])
          handler(payload);
      });
    }
    socket.on("move:rejected", (position: { x: number; y: number }) =>
      Object.assign(this.state.world, position),
    );
    socket.on("player:joined", (player: WorldPlayer) => {
      this.state.world.players = [
        ...this.state.world.players.filter(
          (p) => p.characterId !== player.characterId,
        ),
        player,
      ];
    });
    socket.on("player:left", ({ characterId }: { characterId: number }) => {
      this.state.world.players = this.state.world.players.filter(
        (p) => p.characterId !== characterId,
      );
    });
    socket.on(
      "player:moved",
      (patch: { characterId: number; x: number; y: number }) => {
        const player = this.state.world.players.find(
          (p) => p.characterId === patch.characterId,
        );
        if (player) Object.assign(player, patch);
      },
    );
    socket.on("monster:appeared", (monsters: Monster[]) => {
      for (const monster of monsters)
        this.state.world.monsters = [
          ...this.state.world.monsters.filter((m) => m.id !== monster.id),
          monster,
        ];
    });
    socket.on(
      "monster:update",
      (patches: { id: number; x: number; y: number }[]) => {
        for (const patch of patches) {
          const monster = this.state.world.monsters.find(
            (m) => m.id === patch.id,
          );
          if (monster) Object.assign(monster, patch);
        }
      },
    );
    socket.on("monster:disappeared", (ids: number[]) => {
      this.state.world.monsters = this.state.world.monsters.filter(
        (m) => !ids.includes(m.id),
      );
    });
    socket.on(
      "monster:hit",
      (hit: {
        id: number;
        hp: number;
        damage: number;
        by: number;
        skill: string;
      }) => {
        const monster = this.state.world.monsters.find((m) => m.id === hit.id);
        if (monster) monster.hp = hit.hp;
        this.notify("monster:hit", `${hit.skill}: ${hit.damage} sát thương`);
      },
    );
    socket.on(
      "monster:attack",
      (hit: { id: number; targetCharacterId: number; damage: number }) => {
        this.notify(
          "monster:attack",
          `${hit.targetCharacterId === this.state.character?.id ? "Bạn" : "Người chơi"} nhận ${hit.damage} sát thương`,
        );
      },
    );
    socket.on("player:hp", (patch: { hp: number; maxHp: number }) =>
      Object.assign(this.state.world, patch),
    );
    socket.on("player:died", ({ respawnIn }: { respawnIn: number }) => {
      Object.assign(this.state.world, {
        hp: 0,
        dead: true,
        respawnAt: Date.now() + respawnIn,
      });
      this.notify("player:died", "Đã trọng thương, đang chờ hồi sinh.");
    });
    socket.on(
      "player:respawned",
      (patch: { x: number; y: number; hp: number; maxHp: number }) => {
        Object.assign(this.state.world, patch, {
          dead: false,
          respawnAt: null,
        });
        this.notify("player:respawned", "Đã hồi sinh.");
      },
    );
    socket.on("player:exp", (patch: { exp: number; expNeeded: number }) => {
      if (this.state.character) Object.assign(this.state.character, patch);
    });
    socket.on("player:loot", (loot: Loot) => {
      this.state.lastLoot = loot;
      this.notify(
        "player:loot",
        `Nhận ${loot.exp} tu vi${loot.items.length ? `, ${loot.items.map((i) => `${i.name} ×${i.count}`).join(", ")}` : ""}`,
      );
      this.background(
        Promise.all([this.refreshCharacter(), this.request("inventory:get")]),
      );
    });
    socket.on("chat:message", (message: ChatMessage) => {
      this.state.messages.push(message);
      if (this.state.messages.length > 200) this.state.messages.shift();
    });
    for (const [event, kind] of [
      ["friend:requested", "friend"],
      ["guild:invited", "guild"],
      ["trade:requested", "trade"],
    ] as const) {
      socket.on(event, (data: { from: string; guildName?: string }) => {
        this.state.invitations = this.state.invitations.filter(
          (i) =>
            i.expiresAt > Date.now() &&
            !(i.kind === kind && (kind !== "friend" || i.from === data.from)),
        );
        this.state.invitations.push({
          id: this.nextId++,
          kind,
          ...data,
          expiresAt: Date.now() + 60000,
        });
        this.notify(
          event,
          `${data.from} gửi lời mời ${kind === "friend" ? "kết bạn" : kind === "guild" ? `vào bang ${data.guildName}` : "giao dịch"}.`,
        );
      });
    }
    socket.on("friend:added", ({ name }: { name: string }) => {
      this.notify("friend:added", `Đã kết bạn với ${name}.`);
      this.background(this.request("friend:list"));
    });
    for (const event of [
      "guild:member_joined",
      "guild:member_left",
      "guild:leader_changed",
      "guild:role_changed",
      "guild:kicked",
    ]) {
      socket.on(event, (data: { name?: string; guildName?: string }) => {
        this.notify(
          event,
          `${data.name ?? data.guildName ?? "Bang hội"}: ${event.split(":")[1]}`,
        );
        this.background(
          Promise.all([this.request("guild:info"), this.refreshCharacter()]),
        );
      });
    }
    socket.on("trade:started", (data: { with: string }) => {
      const blank = (name: string) => ({
        name,
        items: {},
        currencies: {},
        confirmed: false,
      });
      this.state.trade = {
        with: data.with,
        me: blank(this.state.character?.name ?? ""),
        other: blank(data.with),
      };
      this.dismissInvitation("trade");
    });
    socket.on("trade:update", (data: TradeView) => {
      this.state.trade = { with: data.other.name, ...data };
    });
    socket.on("trade:completed", () => {
      this.state.trade = null;
      this.notify("trade:completed", "Giao dịch hoàn tất.");
      this.background(
        Promise.all([this.refreshCharacter(), this.request("inventory:get")]),
      );
    });
    socket.on("trade:cancelled", ({ reason }: { reason: string }) => {
      this.state.trade = null;
      this.notify("trade:cancelled", reason);
    });
  }
}

export const gameClient = new GameClient();
export const client = gameClient;
