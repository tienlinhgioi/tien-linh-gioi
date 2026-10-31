import { Application, type ApplicationOptions } from "pixi.js";

export type GameRendererMode = "webgl2" | "webgl1" | "canvas";

export class RendererInitializationError extends AggregateError {
  constructor(errors: unknown[]) {
    super(errors, "Không thể khởi tạo đồ họa WebGL hoặc Canvas 2D.");
    this.name = "RendererInitializationError";
  }
}

/** Destroy only initialized applications; Pixi's destroy assumes its plugins ran. */
export function destroyGameApplication(app: Application): void {
  if (app.renderer) app.destroy(true, { children: true });
  else if (app.stage && !app.stage.destroyed)
    app.stage.destroy({ children: true });
}

/**
 * Capability probes cannot guarantee that a real context can be allocated.
 * Retry each backend with a fresh canvas and release failed GPU contexts.
 * Scene construction stays with the caller, so its errors remain distinguishable.
 */
export async function createGameApplication(
  options: Partial<ApplicationOptions>,
): Promise<{ app: Application; mode: GameRendererMode }> {
  const failures: unknown[] = [];
  const mobile =
    window.matchMedia("(pointer: coarse)").matches || innerWidth < 700;
  const resolution = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5);

  for (const mode of ["webgl2", "webgl1", "canvas"] as const) {
    const canvas = document.createElement("canvas");
    const app = new Application();
    let context: WebGLRenderingContext | WebGL2RenderingContext | null = null;
    try {
      if (mode !== "canvas") {
        const attributes: WebGLContextAttributes = {
          alpha: (options.backgroundAlpha ?? 1) < 1,
          premultipliedAlpha: true,
          antialias: false,
          stencil: true,
          powerPreference: "low-power",
          preserveDrawingBuffer: false,
          failIfMajorPerformanceCaveat: false,
        };
        context =
          mode === "webgl2"
            ? canvas.getContext("webgl2", attributes)
            : canvas.getContext("webgl", attributes);
        if (!context) throw new Error(`${mode}: context unavailable`);
      }
      await app.init({
        ...options,
        canvas,
        // Pixi supports WebGL1 at runtime, although its context option is typed as WebGL2.
        context: (context ?? undefined) as ApplicationOptions["context"],
        preference: [mode === "canvas" ? "canvas" : "webgl"],
        preferWebGLVersion: mode === "webgl1" ? 1 : 2,
        antialias: false,
        powerPreference: "low-power",
        failIfMajorPerformanceCaveat: false,
        autoDensity: true,
        resolution,
      });
      canvas.dataset.renderer = mode;
      return { app, mode };
    } catch (error) {
      failures.push(error);
      // Application.init only assigns its renderer after renderer.init resolves.
      // Keep our context reference so even that rejection releases GPU memory.
      try {
        destroyGameApplication(app);
      } catch (cleanupError) {
        console.warn(
          "Không thể dọn ứng dụng đồ họa chưa khởi tạo:",
          cleanupError,
        );
      } finally {
        context?.getExtension("WEBGL_lose_context")?.loseContext();
        canvas.remove();
        canvas.width = canvas.height = 0;
      }
    }
  }
  throw new RendererInitializationError(failures);
}
