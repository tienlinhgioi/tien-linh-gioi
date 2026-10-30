import { Container, Graphics } from "pixi.js";

/** Eight view directions; only the illustration flips, never nameplates or bars. */
export function createHero() {
  const root = new Container();
  root.addChild(
    new Graphics().ellipse(0, 18, 21, 8).fill({ color: 0x234b3e, alpha: 0.2 }),
  );
  const body = new Graphics();
  root.addChild(body);
  let previous = "";
  return {
    root,
    pose(
      direction: number,
      walking: boolean,
      time: number,
      attacking: boolean,
    ) {
      const frame = walking ? Math.floor(time * 8) % 4 : 0;
      const key = `${direction}:${frame}:${attacking}`;
      if (key === previous) return;
      previous = key;
      const back = direction >= 5 && direction <= 7;
      const side = direction === 0 || direction === 4;
      const mirror = direction >= 3 && direction <= 5 ? -1 : 1;
      body.scale.x = mirror;
      const diagonal = direction % 2 === 1;
      body.skew.x = diagonal ? (back ? -0.13 : 0.13) : 0;
      body.scale.y = diagonal ? 0.96 : 1;
      body.rotation = attacking ? 0.12 : 0;
      const stride = walking ? Math.sin((frame * Math.PI) / 2) * 5 : 0;
      body.clear();
      body
        .moveTo(-6, 9)
        .lineTo(-7 + stride, 20)
        .moveTo(6, 9)
        .lineTo(7 - stride, 20)
        .stroke({ color: 0x416453, width: 6 });
      body
        .moveTo(-8, -17)
        .quadraticCurveTo(-18, 0, -16, 15)
        .quadraticCurveTo(0, 22, 16, 15)
        .quadraticCurveTo(17, 0, 8, -17)
        .fill(0xf6f0d9)
        .stroke({ color: 0x729580, width: 1 });
      body
        .moveTo(-7, -12)
        .lineTo(-23 - stride / 2, 2)
        .lineTo(-18 - stride / 2, 9)
        .lineTo(-4, 0)
        .fill(0xdce8d3);
      body
        .moveTo(7, -12)
        .lineTo(attacking ? 32 : 23, attacking ? -18 : 3)
        .lineTo(attacking ? 35 : 18, attacking ? -9 : 10)
        .lineTo(5, 0)
        .fill(0xf8f3dd);
      body
        .moveTo(0, -13)
        .lineTo(-5, 15)
        .lineTo(6, 17)
        .lineTo(7, -13)
        .fill(0x8ab9a3);
      body.rect(-10, -1, 20, 4).fill(0x417b67);
      body
        .moveTo(0, 2)
        .quadraticCurveTo(20, 8 + stride, 25, 15 + stride)
        .stroke({ color: 0x7fae99, width: 3 });
      body.ellipse(0, -25, 12, 17).fill(0x243c39);
      if (!back) {
        body.ellipse(side ? 4 : 0, -23, side ? 7 : 9, 11).fill(0xf2d7bb);
        body
          .moveTo(-12, -28)
          .quadraticCurveTo(0, -46, 12, -28)
          .lineTo(3, -29)
          .lineTo(-4, -21)
          .lineTo(-8, -28)
          .fill(0x263e3a);
        body.circle(side ? 8 : 5, -23, 1.3).fill(0x385047);
        if (!side) body.circle(-4, -23, 1.3).fill(0x385047);
      }
      if (back || !side)
        body
          .moveTo(-10, -27)
          .quadraticCurveTo(-17, 0, -8, 8)
          .lineTo(1, -1)
          .lineTo(-2, -28)
          .fill(0x29453f);
      if (back)
        body
          .moveTo(8, -28)
          .quadraticCurveTo(17, -2, 8, 11)
          .lineTo(-3, -2)
          .lineTo(-1, -28)
          .fill(0x29453f);
      body.circle(0, -41, 5).fill(0x263e3a).rect(-8, -40, 16, 2).fill(0xd8cd97);
      body
        .moveTo(2, -39)
        .quadraticCurveTo(18, -35, 20 + stride, -24)
        .stroke({ color: 0x83b9a8, width: 2 });
      body
        .moveTo(attacking ? 33 : 22, attacking ? -12 : -10)
        .lineTo(attacking ? 56 : 26, attacking ? -42 : 17)
        .stroke({ color: 0xe4f5ea, width: 3 });
      body
        .moveTo(attacking ? 30 : 18, attacking ? -10 : 7)
        .lineTo(attacking ? 39 : 30, attacking ? -6 : 5)
        .stroke({ color: 0xbca66d, width: 3 });
    },
  };
}
