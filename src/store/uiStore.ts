import { create } from "zustand";

export type UiSettings = {
  sidebarOpen: boolean;
  isFullScreen: boolean;
};

type UiState = UiSettings & {
  hydrated: boolean;
};

type UiActions = {
  hydrate: (settings: Partial<UiSettings>) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setIsFullScreen: (isFullScreen: boolean) => void;
};

export const useUiStore = create<UiState & { actions: UiActions }>((set, get) => ({
  hydrated: false,
  sidebarOpen: false,
  isFullScreen: false,
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
  },
}));

