import { Container, Graphics } from "pixi.js";
import type { Point } from "../data/game";
export function createEffects(layer: Container) {
  const active: {
    view: Graphics;
    age: number;
    duration: number;
    from: Point;
    to: Point;
    skill: boolean;
  }[] = [];
  return {
    cast(from: Point, to: Point, skill: boolean) {
      const view = new Graphics();
      layer.addChild(view);
      active.push({
        view,
        age: 0,
        duration: skill ? 0.65 : 0.3,
        from: { ...from },
        to: { ...to },
        skill,
      });
    },
    update(dt: number) {
      for (let i = active.length - 1; i >= 0; i--) {
        const fx = active[i]!;
        fx.age += dt;
        const t = Math.min(1, fx.age / fx.duration);
        const g = fx.view;
        g.clear();
        const angle = Math.atan2(fx.to.y - fx.from.y, fx.to.x - fx.from.x);
        if (fx.skill) {
          const travel = Math.min(1, t * 2);
          const x = fx.from.x + (fx.to.x - fx.from.x) * travel,
            y = fx.from.y + (fx.to.y - fx.from.y) * travel;
          g.moveTo(x - Math.cos(angle) * 65, y - Math.sin(angle) * 65 - 15)
            .lineTo(x, y - 15)
            .stroke({ color: 0x8af0d2, width: 14, alpha: (1 - t) * 0.35 });
          g.moveTo(x - Math.cos(angle) * 48, y - Math.sin(angle) * 48 - 15)
            .lineTo(x, y - 15)
            .stroke({ color: 0xf2ffe7, width: 4, alpha: 1 - t });
          g.ellipse(fx.from.x, fx.from.y + 10, 35 + t * 35, 14 + t * 14).stroke(
            { color: 0xb4e5c6, width: 2, alpha: 1 - t },
          );
          if (t > 0.4) {
            g.circle(fx.to.x, fx.to.y - 10, (t - 0.4) * 90).stroke({
              color: 0xc8ffe3,
              width: 3,
              alpha: 1 - t,
            });
          }
          for (let j = 0; j < 8; j++) {
            const a = (j * Math.PI) / 4 + t * 2;
            g.circle(
              x + Math.cos(a) * t * 55,
              y - 15 + Math.sin(a) * t * 55,
              2,
            ).fill({ color: 0xf8df9a, alpha: 1 - t });
          }
        } else {
          g.position.set(fx.from.x, fx.from.y - 15);
          g.rotation = angle;
          g.moveTo(25, -45 + t * 15)
            .quadraticCurveTo(110, 0, 25, 45 - t * 15)
            .stroke({ color: 0xfff4c6, width: 7, alpha: 1 - t });
          g.moveTo(32, -37 + t * 15)
            .quadraticCurveTo(90, 0, 32, 37 - t * 15)
            .stroke({ color: 0xffffff, width: 2, alpha: 1 - t });
        }
        if (t === 1) {
          g.destroy();
          active.splice(i, 1);
        }
      }
    },
    clear() {
      active.forEach((f) => f.view.destroy());
      active.length = 0;
    },
  };
}
