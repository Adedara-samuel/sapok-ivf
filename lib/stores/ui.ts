import { createDomainStore } from "@/lib/stores/core";

export interface UiState {
  sidebarCollapsed: boolean;
  tourActive: boolean;
  tourStep: number;
  assistantOpen: boolean;
  toggleAssistant: () => void;
  setAssistantOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  startTour: () => void;
  setTourStep: (step: number) => void;
  endTour: () => void;
}

export const useUiStore = createDomainStore<UiState>("ui", (set) => ({
  sidebarCollapsed: false,
  tourActive: false,
  tourStep: 0,
  assistantOpen: false,
  toggleAssistant: () =>
    set((s) => {
      s.assistantOpen = !s.assistantOpen;
    }),
  setAssistantOpen: (open) =>
    set((s) => {
      s.assistantOpen = open;
    }),
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
