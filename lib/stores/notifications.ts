import { notificationSchema, type AppNotification } from "@/lib/schemas/admin";
import type { SeedData } from "@/lib/seed/types";
import { createDomainStore, validate } from "@/lib/stores/core";
import { nowIso } from "@/lib/utils/dates";
import { newId } from "@/lib/utils/ids";

export interface NotificationState {
  notifications: AppNotification[];
  push: (input: { userId: string; title: string; body: string; href?: string }) => AppNotification;
  markRead: (id: string) => void;
  markAllRead: (userId: string) => void;
  reset: (seed: SeedData) => void;
}

export const useNotificationStore = createDomainStore<NotificationState>("notifications", (set) => ({
  notifications: [],
  push: (input) => {
    const n = validate(notificationSchema, { ...input, id: newId("NTF"), at: nowIso(), read: false });
    set((s) => {
      s.notifications.push(n);
    });
    return n;
  },
  markRead: (id) =>
    set((s) => {
      const n = s.notifications.find((x) => x.id === id);
      if (n) n.read = true;
    }),
  markAllRead: (userId) =>
    set((s) => {
      s.notifications.forEach((n) => {
        if (n.userId === userId) n.read = true;
      });
    }),
  reset: (seed) =>
    set((s) => {
      s.notifications = seed.notifications;
    }),
}));
