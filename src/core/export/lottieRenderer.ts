import lottie from "lottie-web";
import JSZip from "jszip";

export interface AnimationMeta {
  animationData: Record<string, unknown>;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
}

// ── Extract animationData from .lottie zip ────────────────
// Mirrors LottiePlayer.tsx: resolves the animation JSON, extracts all
// images from the archive, converts them to base64 data URLs and patches
// the assets array so lottie-web can render them without filesystem access.
async function extractLottieData(buffer: ArrayBuffer): Promise<Record<string, unknown>> {
  const zip      = await JSZip.loadAsync(buffer);
  const allPaths = Object.keys(zip.files);

  const norm       = (p: string) => p.replace(/\\/g, "/");
  const pathExists = (p: string) => zip.file(norm(p)) != null;

  // ── 1. Locate the animation JSON ──────────────────────
  let animPath: string | null = null;

  const manifestPath = allPaths.find(
    (p) => p === "manifest.json" || p.endsWith("/manifest.json")
  );
  if (manifestPath) {
    try {
      const manifest = JSON.parse(
        await zip.file(manifestPath)!.async("text")
      ) as Record<string, unknown>;

      const anims = manifest.animations as Array<{ path?: string; id?: string }> | undefined;
      if (Array.isArray(anims) && anims.length > 0) {
        const first = anims[0];
        if (typeof first.path === "string" && first.path) {
          animPath = first.path.replace(/^\//, "").replace(/\\/g, "/");
        } else if (first?.id) {
          const id = String(first.id).trim();
          const candidates = [
            `${id}/animation.json`, `${id}/data.json`,
            `animations/${id}.json`, `animations/${id}/animation.json`,
            `animations/${id}/data.json`,
          ];
          for (const c of candidates) {
            if (pathExists(c)) { animPath = c; break; }
          }
          if (!animPath) {
            const nested = allPaths.find((p) => {
              const n = norm(p);
              return n === `${id}/animation.json` || n === `${id}/data.json` ||
                     n === `animations/${id}.json` ||
                     (n.includes(id) && (n.endsWith("/animation.json") || n.endsWith("/data.json") || n.endsWith(`/${id}.json`)));
            });
            if (nested) animPath = norm(nested);
          }
        }
      }
      const main = manifest.main as string | undefined;
      if (!animPath && typeof main === "string" && main)
        animPath = main.replace(/^\//, "").replace(/\\/g, "/");
    } catch { /* ignore */ }
  }

  if (!animPath) {
    const found = allPaths.find((p) => {
      const n = norm(p);
      return n === "animation.json" || n.endsWith("/animation.json") ||
             n === "data.json"      || n.endsWith("/data.json");
    });
    if (found) animPath = norm(found);
  }

  if (!animPath) {
    for (const p of allPaths) {
      if (p.endsWith("/") || !p.toLowerCase().endsWith(".json") || p === "manifest.json") continue;
      try {
        const data = JSON.parse(await zip.file(p)!.async("text")) as Record<string, unknown>;
        if (typeof data.w === "number" && typeof data.h === "number") { animPath = norm(p); break; }
      } catch { /* skip */ }
    }
  }

  if (!animPath) throw new Error("animation.json not found inside .lottie");
  const animEntry = zip.file(animPath);
  if (!animEntry) throw new Error(`Cannot read ${animPath} from .lottie archive`);

  // Deep-clone so we can safely mutate assets
  const animationData = JSON.parse(await animEntry.async("text")) as Record<string, unknown>;

  // ── 2. Extract all images → base64 data URLs ──────────
  const mimeFromExt = (name: string): string => {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "png")  return "image/png";
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "webp") return "image/webp";
    if (ext === "gif")  return "image/gif";
    return "image/png";
  };

  // Directory of animation.json within the zip (empty string if at root)
  const animBaseDir = animPath.includes("/")
    ? animPath.replace(/\/[^/]+$/, "/")
    : "";

  const imageMap: Record<string, string> = {};
  for (const p of allPaths) {
    if (p.endsWith("/") || !/\.(png|jpe?g|webp|gif)$/i.test(p)) continue;
    const entry = zip.file(p);
    if (!entry) continue;
    const base64  = await entry.async("base64");
    const baseName = p.replace(/^.*\//, "");
    const dataUrl  = `data:${mimeFromExt(baseName)};base64,${base64}`;
    const n = norm(p);
    imageMap[n]                     = dataUrl;
    imageMap[baseName]              = dataUrl;
    imageMap[`images/${baseName}`]  = dataUrl;
    if (n.startsWith(animBaseDir))
      imageMap[n.slice(animBaseDir.length)] = dataUrl;
  }

  // ── 3. Patch assets with embedded data URLs ────────────
  type Asset = { layers?: unknown; u?: string; p?: string; e?: number };
  const assets = animationData.assets as Asset[] | undefined;
  if (Array.isArray(assets)) {
    for (const asset of assets) {
      if (asset.layers != null || !asset.p) continue;       // skip composition assets
      const logicalPath = ((asset.u ?? "") + asset.p).replace(/^\//, "");
      const dataUrl =
        imageMap[logicalPath] ??
        imageMap[animBaseDir + logicalPath] ??
        imageMap[asset.p]                  ??
        imageMap[`images/${asset.p}`]      ??
        imageMap[asset.p.replace(/^.*\//, "")];
      if (dataUrl) {
        asset.e = 1;   // mark as embedded
        asset.p = dataUrl;
        asset.u = "";  // clear base path
      }
    }
  }

  return animationData;
}

// ── Parse metadata from animationData ────────────────────
export function parseAnimMeta(data: Record<string, unknown>): {
  width: number; height: number; fps: number; totalFrames: number;
} {
  const w    = (data.w as number)  || 512;
  const h    = (data.h as number)  || 512;
  const fps  = (data.fr as number) || 30;
  const ip   = (data.ip as number) ?? 0;
  const op   = (data.op as number) ?? 0;
  return { width: w, height: h, fps, totalFrames: Math.max(1, Math.round(op - ip)) };
}

// ── Patch external image references in a .json animation ─
// Reads images from the same directory as the JSON file (if path known)
// and embeds them as base64 data URLs so the offscreen renderer can use them.
async function patchJsonImages(
  animationData: Record<string, unknown>,
  filePath: string | undefined,
): Promise<Record<string, unknown>> {
  type Asset = { layers?: unknown; u?: string; p?: string; e?: number };
  const assets = animationData.assets as Asset[] | undefined;
  if (!Array.isArray(assets)) return animationData;

  // Check if any assets are external (not already embedded as data URLs)
  const hasExternal = assets.some(
    (a) => a.layers == null && a.p && !String(a.p).startsWith("data:")
  );
  if (!hasExternal) return animationData;

  // We need the file's directory to look for external images
  if (!filePath) return animationData;

  const sep   = filePath.includes("\\") ? "\\" : "/";
  const fileDir = filePath.slice(0, filePath.lastIndexOf(sep));

  // Collect unique image directories referenced by the assets
  const imageDirs = new Set<string>();
  for (const asset of assets) {
    if (asset.layers != null || !asset.p || String(asset.p).startsWith("data:")) continue;
    const u = String(asset.u ?? "").replace(/\\/g, "/").replace(/\/$/, "");
    const subDir = u
      ? fileDir + sep + u.replace(/\//g, sep)
      : fileDir;
    imageDirs.add(subDir);
  }

  // Read all image files from those directories via IPC
  const allImages: Record<string, string> = {};
  for (const dir of imageDirs) {
    const files = await window.api.readImageFiles(dir).catch(() => ({}));
    Object.assign(allImages, files);
  }

  if (Object.keys(allImages).length === 0) return animationData;

  // Deep-clone before mutating
  const cloned = JSON.parse(JSON.stringify(animationData)) as Record<string, unknown>;
  const clonedAssets = cloned.assets as Asset[];

  for (const asset of clonedAssets) {
    if (asset.layers != null || !asset.p || String(asset.p).startsWith("data:")) continue;
    const baseName = String(asset.p).replace(/^.*[/\\]/, "");
    const dataUrl  = allImages[baseName];
    if (dataUrl) {
      asset.e = 1;
      asset.p = dataUrl;
      asset.u = "";
    }
  }

  return cloned;
}

// ── Load animation data from file ────────────────────────
export async function loadAnimationData(
  extension: string,
  text: string | undefined,
  buffer: ArrayBuffer | undefined,
  filePath?: string,
): Promise<{ animationData: Record<string, unknown> } & ReturnType<typeof parseAnimMeta>> {
  let animationData: Record<string, unknown>;

  if (extension === "json") {
    if (!text) throw new Error("No JSON text in file");
    const parsed = JSON.parse(text) as Record<string, unknown>;
    // Embed any external images from disk
    animationData = await patchJsonImages(parsed, filePath);
  } else if (extension === "lottie") {
    if (!buffer) throw new Error("No buffer in .lottie file");
    animationData = await extractLottieData(buffer);
  } else {
    throw new Error(`Unsupported format for export: .${extension}`);
  }

  return { animationData, ...parseAnimMeta(animationData) };
}

// ── Setup offscreen lottie canvas renderer ────────────────
// Returns an output canvas where each frame = background fill + lottie composited on top.
// backgroundColor: hex like "#1c1c1c". Default black if not provided.
export async function createLottieCanvasRenderer(
  animationData: Record<string, unknown>,
  width: number,
  height: number,
  backgroundColor = "#000000",
): Promise<{
  canvas: HTMLCanvasElement;   // output canvas — pass this to VideoEncoder
  renderFrame: (index: number) => Promise<void>;
  destroy: () => void;
}> {
  // Hidden container for lottie's own canvas
  const container = document.createElement("div");
  container.style.cssText = [
    "position:fixed",
    "left:-99999px",
    "top:-99999px",
    `width:${width}px`,
    `height:${height}px`,
    "overflow:hidden",
    "pointer-events:none",
    "visibility:hidden",
  ].join(";");
  document.body.appendChild(container);

  const anim = lottie.loadAnimation({
    container,
    renderer: "canvas",
    loop: false,
    autoplay: false,
    animationData,
    rendererSettings: {
      preserveAspectRatio: "xMidYMid meet",
      clearCanvas: true,   // lottie manages its own canvas
    } as Record<string, unknown>,
  });

  await new Promise<void>((resolve, reject) => {
    anim.addEventListener("DOMLoaded", () => resolve());
    anim.addEventListener("error", () => reject(new Error("Lottie canvas failed to load")));
    setTimeout(() => reject(new Error("Lottie init timeout")), 15_000);
  });

  const lottieCanvas = container.querySelector("canvas") as HTMLCanvasElement;
  if (!lottieCanvas) throw new Error("Canvas element not found after DOMLoaded");
  // Do NOT override lottieCanvas.width/height — lottie sets them
  // correctly (possibly at DPR × size on HiDPI displays). Overriding
  // would shrink the canvas while lottie keeps drawing at the original
  // scale, showing only the top-left fragment of the animation.

  // Output canvas is always at logical (animation) dimensions.
  // We scale the lottie canvas into it via drawImage, which handles
  // any DPR mismatch transparently.
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width  = width;
  outputCanvas.height = height;
  const outCtx = outputCanvas.getContext("2d")!;

  const renderFrame = async (index: number): Promise<void> => {
    anim.goToAndStop(index, true);
    await new Promise((r) => requestAnimationFrame(r));

    if (backgroundColor === "transparent") {
      // For compose export: clear to transparent so the animation
      // alpha is preserved when composited externally.
      outCtx.clearRect(0, 0, width, height);
    } else {
      outCtx.fillStyle = backgroundColor;
      outCtx.fillRect(0, 0, width, height);
    }
    outCtx.drawImage(lottieCanvas, 0, 0, width, height);
  };

  const destroy = () => {
    anim.destroy();
    document.body.removeChild(container);
  };

  return { canvas: outputCanvas, renderFrame, destroy };
}
