import { test } from "node:test";
import assert from "node:assert/strict";
import { validateIdentity } from "../src/data/world.ts";
import {
  canWalk,
  distance,
  monsterSeeds,
  movePlayer,
  obstacles,
  PLAYER_SPEED,
} from "../src/data/game.ts";

test("sample identities require valid names and matching registration passwords", () => {
  assert.match(validateIdentity("A", "abcdef", undefined), /Đạo danh/);
  assert.match(validateIdentity("Thanh Vân", "123", undefined), /Mật khẩu/);
  assert.match(validateIdentity("Thanh Vân", "abcdef", "abcdex"), /trùng khớp/);
  assert.equal(validateIdentity("Thanh Vân", "abcdef", "abcdef"), "");
});
test("diagonal movement has the same speed as movement in one direction", () => {
  const origin = { x: 1200, y: 650 };
  const straight = movePlayer(origin, { x: 1, y: 0 }, 0.016);
  const diagonal = movePlayer(origin, { x: 1, y: 1 }, 0.016);
  assert.ok(
    Math.abs(distance(origin, straight) - distance(origin, diagonal)) < 0.00001,
  );
  assert.ok(
    Math.abs(distance(origin, straight) - PLAYER_SPEED * 0.016) < 0.00001,
  );
  assert.deepEqual(movePlayer(origin, { x: 0, y: 0 }, 0.016), origin);
});
test("movement respects world boundaries, obstacles, and the river crossing", () => {
  assert.equal(canWalk({ x: 20, y: 300 }), false);
  assert.equal(canWalk(obstacles[0]!), false);
  assert.equal(canWalk({ x: 800, y: 930 }), false);
  assert.equal(canWalk({ x: 1200, y: 930 }), true);
  assert.deepEqual(movePlayer({ x: 800, y: 865 }, { x: 0, y: 1 }, 0.05), {
    x: 800,
    y: 865,
  });
  assert.ok(movePlayer({ x: 1200, y: 865 }, { x: 0, y: 1 }, 0.05).y > 870);
});
test("long frame delays do not teleport the character through map obstacles", () => {
  const origin = { x: 1200, y: 650 };
  assert.ok(
    distance(origin, movePlayer(origin, { x: 1, y: 0 }, 20)) <=
      PLAYER_SPEED * 0.05 + 0.00001,
  );
});
test("sample monsters have unique identifiers, valid spawns and positive rewards", () => {
  assert.equal(
    new Set(monsterSeeds.map((m) => m.id)).size,
    monsterSeeds.length,
  );
  assert.ok(monsterSeeds.every((m) => canWalk(m) && m.maxHp > 0 && m.exp > 0));
});
