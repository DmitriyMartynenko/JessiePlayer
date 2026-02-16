export interface AnimationDiagnostics {
  width: number;
  height: number;
  fps: number;
  frames: number;
  durationSec: number;
  layers: number;
  assets: number;
  bodymovinVersion?: string;
  imageCount: number;
  embeddedImageCount: number;
  externalImageCount: number;
  warnings: string[];
}

export function analyzeLottieJson(data: any): AnimationDiagnostics {
  const warnings: string[] = [];

  if (!data || typeof data !== "object") {
    return {
      width: 0,
      height: 0,
      fps: 0,
      frames: 0,
      durationSec: 0,
      layers: 0,
      assets: 0,
      bodymovinVersion: undefined,
      imageCount: 0,
      embeddedImageCount: 0,
      externalImageCount: 0,
      warnings: ["Missing required fields"],
    };
  }

  const width = typeof data?.w === "number" ? data.w : 0;
  const height = typeof data?.h === "number" ? data.h : 0;
  const fps = typeof data?.fr === "number" ? data.fr : 0;
  const ip = typeof data?.ip === "number" ? data.ip : 0;
  const op = typeof data?.op === "number" ? data.op : 0;

  const layersCount = Array.isArray(data?.layers) ? data.layers.length : 0;
  const assetsCount = Array.isArray(data?.assets) ? data.assets.length : 0;
  const bodymovinVersion =
    typeof data?.v === "string" && data.v.trim().length > 0
      ? data.v.trim()
      : undefined;

  const frames = op - ip;
  const durationRaw = fps > 0 ? frames / fps : 0;
  const durationSec = Number.isFinite(durationRaw)
    ? parseFloat(durationRaw.toFixed(2))
    : 0;

  // ─────────────────────────────────────────────
  // Image statistics
  // ─────────────────────────────────────────────

  let imageCount = 0;
  let embeddedImageCount = 0;
  let externalImageCount = 0;

  if (Array.isArray(data.assets)) {
    for (const asset of data.assets) {
      if (!asset || typeof asset !== "object") continue;
      const a: any = asset;

      // Lottie convention: image asset has p (path) and no layers
      if (a.p == null || a.layers != null) continue;

      const p = a.p;
      if (typeof p !== "string") continue;

      imageCount += 1;

      if (p.startsWith("data:")) {
        embeddedImageCount += 1;
      } else {
        externalImageCount += 1;
      }
    }
  }

  // 4) Expressions (layer.ef or property.x)
  let hasExpressions = false;

  const scanForExpressions = (obj: any) => {
    if (!obj || typeof obj !== "object") return;

    if ("ef" in obj && Array.isArray((obj as any).ef)) {
      hasExpressions = true;
      return;
    }

    if ("x" in obj && typeof (obj as any).x === "string") {
      hasExpressions = true;
      return;
    }

    for (const key of Object.keys(obj)) {
      const value = (obj as any)[key];
      if (value && typeof value === "object") {
        scanForExpressions(value);
        if (hasExpressions) return;
      }
    }
  };

  if (Array.isArray(data?.layers)) {
    for (const layer of data.layers) {
      scanForExpressions(layer);
      if (hasExpressions) break;
    }
  }

  if (hasExpressions) {
    warnings.push("Expressions detected");
  }

  // 5) Missing required fields (width, height, fps, layers, assets)
  const hasWidth = "w" in data && typeof (data as any).w === "number";
  const hasHeight = "h" in data && typeof (data as any).h === "number";
  const hasFps = "fr" in data && typeof (data as any).fr === "number";
  const hasLayers = Array.isArray((data as any).layers);
  const hasAssets = Array.isArray((data as any).assets);

  if (!hasWidth || !hasHeight || !hasFps || !hasLayers || !hasAssets) {
    warnings.push("Missing required fields");
  }

  // 6) Broken or missing image references (image asset with empty or invalid path)
  let hasBrokenImages = false;
  if (Array.isArray(data.assets)) {
    for (const asset of data.assets) {
      if (!asset || typeof asset !== "object") continue;
      const a: any = asset;
      if (a.layers != null) continue;
      if (!("p" in a)) continue;
      if (typeof a.p !== "string" || a.p.trim().length === 0) {
        hasBrokenImages = true;
        break;
      }
    }
  }

  if (hasBrokenImages) {
    warnings.push("Broken or missing image references");
  }

  return {
    width,
    height,
    fps,
    frames,
    durationSec,
    layers: layersCount,
    assets: assetsCount,
    bodymovinVersion,
    imageCount,
    embeddedImageCount,
    externalImageCount,
    warnings,
  };
}

