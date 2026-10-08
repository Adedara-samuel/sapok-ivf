import { createDomainStore } from "@/lib/stores/core";

export interface UiState {
  sidebarCollapsed: boolean;
  tourActive: boolean;
  tourStep: number;
  toggleSidebar: () => void;
  startTour: () => void;
  setTourStep: (step: number) => void;
  endTour: () => void;
}

export const useUiStore = createDomainStore<UiState>("ui", (set) => ({
  sidebarCollapsed: false,
  tourActive: false,
  tourStep: 0,
  toggleSidebar: () =>
    set((s) => {
      s.sidebarCollapsed = !s.sidebarCollapsed;
    }),
  startTour: () =>
    set((s) => {
      s.tourActive = true;
      s.tourStep = 0;
    }),
  setTourStep: (step) =>
    set((s) => {
      s.tourStep = step;
    }),
  endTour: () =>
    set((s) => {
      s.tourActive = false;
      s.tourStep = 0;
    }),
}));
