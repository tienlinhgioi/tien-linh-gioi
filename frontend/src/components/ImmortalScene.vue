<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { Application, Container, Graphics } from "pixi.js";

const host = ref<HTMLDivElement>();
const unavailable = ref(false);
let app: Application | undefined;
let observer: ResizeObserver | undefined;
let disposed = false;

onMounted(async () => {
  if (!host.value) return;
  const instance = new Application();
  app = instance;
  try {
    await instance.init({
      width: 1400,
      height: 850,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(devicePixelRatio, 2),
      autoDensity: true,
      preference: "webgl",
    });
    if (disposed) {
      instance.destroy(true, { children: true });
      return;
    }
    host.value.appendChild(instance.canvas);
    const world = new Container();
    instance.stage.addChild(world);
    const mountain = (points: number[], color: number, alpha = 1) => {
      const g = new Graphics().poly(points).fill({ color, alpha });
      world.addChild(g);
      return g;
    };
    // Layered ink-wash silhouettes, composed locally without remote assets.
    world.addChild(
      new Graphics()
        .circle(1050, 175, 79)
        .fill({ color: 0xfff9df, alpha: 0.85 }),
    );
    mountain(
      [
        0, 470, 0, 300, 90, 260, 140, 140, 190, 230, 230, 175, 290, 340, 365,
        290, 460, 390, 550, 270, 640, 350, 720, 190, 760, 220, 790, 110, 840,
        190, 890, 140, 960, 350, 1080, 280, 1160, 160, 1220, 250, 1310, 180,
        1400, 320, 1400, 620,
      ],
      0xb0c9c3,
      0.65,
    );
    mountain(
      [
        0, 600, 0, 460, 90, 400, 160, 430, 235, 290, 280, 370, 320, 310, 380,
        430, 440, 390, 520, 510, 650, 410, 750, 490, 850, 380, 890, 290, 920,
        340, 955, 220, 995, 320, 1050, 310, 1100, 430, 1210, 370, 1290, 430,
        1400, 350, 1400, 700,
      ],
      0x7da69d,
      0.7,
    );
    mountain(
      [
        0, 740, 0, 580, 80, 540, 140, 590, 240, 510, 340, 590, 440, 560, 530,
        620, 670, 550, 760, 640, 870, 570, 1000, 650, 1110, 520, 1210, 565,
        1330, 460, 1400, 500, 1400, 850,
      ],
      0x527e75,
      0.8,
    );
    // A ribbon waterfall and the lake below.
    world.addChild(
      new Graphics()
        .moveTo(953, 349)
        .bezierCurveTo(940, 460, 1000, 460, 962, 575)
        .lineTo(977, 580)
        .bezierCurveTo(1010, 463, 952, 446, 964, 349)
        .closePath()
        .fill({ color: 0xe3eee4, alpha: 0.6 }),
    );
    world.addChild(new Graphics().ellipse(755, 784, 640, 115).fill(0xa1c6ba));
    for (let i = 0; i < 24; i++)
      world.addChild(
        new Graphics()
          .ellipse(150 + i * 51, 740 + (i % 6) * 17, 25 + (i % 4) * 30, 1)
          .fill({ color: 0xeaf2dc, alpha: 0.35 }),
      );
    // Floating sanctuary island.
    mountain(
      [
        358, 580, 460, 551, 629, 549, 740, 579, 692, 624, 654, 641, 614, 708,
        564, 661, 519, 685, 474, 626, 403, 617,
      ],
      0x375f56,
    );
    mountain(
      [
        403, 611, 470, 616, 520, 675, 532, 615, 570, 635, 615, 699, 631, 615,
        676, 629, 706, 604, 740, 579, 670, 588, 590, 573, 480, 580,
      ],
      0x648978,
    );
    world.addChild(new Graphics().ellipse(552, 575, 194, 29).fill(0x9dac83));
    world.addChild(new Graphics().ellipse(550, 567, 175, 22).fill(0xc0c7a1));
    world.addChild(
      new Graphics()
        .ellipse(550, 574, 115, 9)
        .stroke({ color: 0xe3ddba, width: 3 }),
    );
    // Graceful pavilion with upturned eaves.
    const temple = new Graphics();
    temple.rect(501, 483, 9, 79).rect(599, 483, 9, 79).fill(0x4b6352);
    temple.rect(516, 496, 74, 60).fill(0xe6debf);
    temple.rect(545, 505, 22, 51).fill(0x697c64);
    temple
      .rect(493, 554, 124, 7)
      .rect(480, 563, 150, 6)
      .rect(473, 571, 165, 5)
      .fill(0xe0d9b7);
    temple
      .moveTo(467, 485)
      .quadraticCurveTo(511, 474, 553, 438)
      .quadraticCurveTo(599, 473, 641, 485)
      .quadraticCurveTo(609, 491, 555, 480)
      .quadraticCurveTo(506, 493, 467, 485)
      .fill(0x304e45);
    temple
      .moveTo(485, 447)
      .quadraticCurveTo(523, 440, 553, 413)
      .quadraticCurveTo(584, 440, 620, 447)
      .quadraticCurveTo(585, 455, 553, 447)
      .quadraticCurveTo(520, 455, 485, 447)
      .fill(0x496a59);
    temple
      .moveTo(553, 413)
      .lineTo(553, 400)
      .stroke({ color: 0xc6b17d, width: 3 });
    temple
      .moveTo(471, 486)
      .quadraticCurveTo(510, 477, 553, 441)
      .quadraticCurveTo(599, 477, 638, 486)
      .stroke({ color: 0xbcb78d, width: 2 });
    world.addChild(temple);
    const tree = (x: number, y: number, s: number, pink = false) => {
      const t = new Graphics();
      t.moveTo(x, y)
        .bezierCurveTo(
          x + 12 * s,
          y - 39 * s,
          x - 9 * s,
          y - 58 * s,
          x + 19 * s,
          y - 92 * s,
        )
        .stroke({ color: 0x435c4a, width: 7 * s });
      t.moveTo(x + 3 * s, y - 39 * s)
        .lineTo(x - 31 * s, y - 65 * s)
        .moveTo(x + 8 * s, y - 57 * s)
        .lineTo(x + 45 * s, y - 80 * s)
        .stroke({ color: 0x435c4a, width: 4 * s });
      const crowns = [
        [-26, -70, 29],
        [13, -98, 34],
        [46, -86, 31],
        [5, -67, 33],
      ];
      crowns.forEach(([cx, cy, r]) =>
        t
          .ellipse(x + cx! * s, y + cy! * s, r! * s, r! * s * 0.5)
          .fill({ color: pink ? 0xd9b7ae : 0x50735c, alpha: 0.95 }),
      );
      world.addChild(t);
    };
    tree(431, 566, 0.88, true);
    tree(663, 564, 0.8);
    tree(713, 576, 0.5);
    // Foreground framing gives the scene a painted, theatrical depth.
    mountain(
      [0, 850, 0, 708, 60, 688, 140, 712, 225, 766, 310, 786, 365, 850],
      0x315b50,
    );
    mountain(
      [1130, 850, 1230, 738, 1290, 718, 1350, 670, 1400, 660, 1400, 850],
      0x315b50,
    );
    tree(80, 770, 2);
    tree(1340, 780, 1.8, true);
    const motes = new Container();
    world.addChild(motes);
    const particles = Array.from({ length: 28 }, (_, i) => {
      const p = new Graphics()
        .ellipse(0, 0, 2 + (i % 3), 1.4)
        .fill({ color: i % 3 === 0 ? 0xf4d6c7 : 0xf3edca, alpha: 0.75 });
      p.position.set((i * 163) % 1400, (i * 97) % 850);
      motes.addChild(p);
      return p;
    });
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!reduced)
      instance.ticker.add((ticker) => {
        particles.forEach((p, i) => {
          p.x += (0.15 + (i % 3) * 0.06) * ticker.deltaTime;
          p.y += Math.sin(ticker.lastTime / 1800 + i) * 0.12 * ticker.deltaTime;
          if (p.x > 1410) p.x = -10;
        });
      });
    const resize = () => {
      if (!host.value) return;
      const { width, height } = host.value.getBoundingClientRect();
      instance.renderer.resize(width, height);
      const scale = Math.max(width / 1400, height / 850);
      world.scale.set(scale);
      world.position.set(
        (width - 1400 * scale) / 2,
        (height - 850 * scale) / 2,
      );
    };
    observer = new ResizeObserver(resize);
    observer.observe(host.value);
    resize();
  } catch {
    unavailable.value = true;
    if (instance.renderer) instance.destroy(true, { children: true });
    app = undefined;
  }
});
onBeforeUnmount(() => {
  disposed = true;
  observer?.disconnect();
  if (app?.renderer) app.destroy(true, { children: true });
});
</script>

<template>
  <div
    ref="host"
    class="immortal-scene"
    :class="{ 'scene-fallback': unavailable }"
    aria-hidden="true"
  >
    <div v-if="unavailable" class="fallback-mountains">山</div>
  </div>
</template>
