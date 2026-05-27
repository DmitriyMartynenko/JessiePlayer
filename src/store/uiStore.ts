import { create } from "zustand";

export type ScaleMode = "fit" | "original" | "compose";

export type ComposeImage = {
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
};

// x, y: animation center in "canvas pixels"
//   - with bg image   → canvas = bgImage (naturalWidth × naturalHeight)
//   - without bg image → canvas = composeCanvasSize
export type ComposeTransform = {
  x: number;
  y: number;
  scale: number;
  opacity: number; // 0–1 (1 = fully opaque)
};

export type ComposeCanvasSize = { w: number; h: number };

export type UiSettings = {
  sidebarOpen: boolean;
  isFullScreen: boolean;
};

const DEFAULT_CANVAS: ComposeCanvasSize = { w: 1920, h: 1080 };

type UiState = UiSettings & {
  hydrated: boolean;
  scaleMode: ScaleMode;
  composeImage: ComposeImage | null;
  composeTransform: ComposeTransform;
  composeCanvasSize: ComposeCanvasSize;
};

type UiActions = {
  hydrate: (settings: Partial<UiSettings>) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setIsFullScreen: (isFullScreen: boolean) => void;
  setScaleMode: (mode: ScaleMode) => void;
  setComposeImage: (img: ComposeImage | null) => void;
  initComposeForImage: (img: ComposeImage, animW: number, animH: number) => void;
  setComposeTransform: (
    t: ComposeTransform | ((prev: ComposeTransform) => ComposeTransform)
  ) => void;
  setComposeCanvasSize: (size: ComposeCanvasSize) => void;
};

export const useUiStore = create<UiState & { actions: UiActions }>((set, get) => ({
  hydrated: false,
  sidebarOpen: false,
  isFullScreen: false,
  scaleMode: "fit",
  composeImage: null,
  composeTransform: {
    x: DEFAULT_CANVAS.w / 2,
    y: DEFAULT_CANVAS.h / 2,
    scale: 1,
    opacity: 1,
  },
  composeCanvasSize: DEFAULT_CANVAS,

  actions: {
    hydrate: (settings) => {
      set({
        hydrated: true,
        sidebarOpen: !!settings.sidebarOpen,
        isFullScreen: !!settings.isFullScreen,
      });
    },
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
    setIsFullScreen: (isFullScreen) => set({ isFullScreen }),
    setScaleMode: (mode) => set({ scaleMode: mode }),

    setComposeImage: (img) => set({ composeImage: img }),

    // When bg image is loaded: canvas = bg image size, animation centered + auto-scaled
    initComposeForImage: (img, animW, animH) => {
      const fit = Math.min(
        (img.naturalWidth  * 0.8) / Math.max(animW, 1),
        (img.naturalHeight * 0.8) / Math.max(animH, 1),
      );
      set({
        composeImage: img,
        composeCanvasSize: { w: img.naturalWidth, h: img.naturalHeight },
        composeTransform: {
          x:       img.naturalWidth  / 2,
          y:       img.naturalHeight / 2,
          scale:   Math.min(fit, 3),
          opacity: get().composeTransform.opacity, // preserve existing opacity
        },
      });
    },

    setComposeTransform: (t) => {
      if (typeof t === "function") {
        set({ composeTransform: t(get().composeTransform) });
      } else {
        set({ composeTransform: t });
      }
    },

    // When user manually changes canvas size (no bg image):
    // keep animation at the proportionally equivalent position in the new canvas.
    setComposeCanvasSize: (newSize) => {
      const prev     = get().composeCanvasSize;
      const transform = get().composeTransform;
      set({
        composeCanvasSize: newSize,
        composeTransform: {
          ...transform,
          x:       (transform.x / prev.w) * newSize.w,
          y:       (transform.y / prev.h) * newSize.h,
        },
      });
    },
  },
}));
