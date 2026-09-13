import { writable } from "svelte/store";
import { postMessageToParent } from "@nucleum/client/runtime/embed/embed.utils";
import { EmbedMessage } from "@nucleum/client/runtime/embed/embedMessage.enum";

/** A scheduled reminder delivered through the native notification contract. */
export type ScheduledNotification = {
  inSeconds: number;
  message: string;
  title?: string;
  timestamp: number;
  sound?: string;
  id: string;
};

/** Focus reminders delivered through the native runtime transport. */
export const scheduledNotifications = initScheduledNotificationStore();

function initScheduledNotificationStore() {
  const { subscribe, set, update } = writable<ScheduledNotification[]>([]);
  return {
    subscribe,
    set: (notifications: ScheduledNotification[]) => {
      set(notifications);
    },
    reset: () => {
      set([]);
      postMessageToParent(EmbedMessage.CLEAR_NOTIFICATIONS);
    },
    notify: (notifications: ScheduledNotification[]) => {
      set(notifications);
    },
    push: (notification: ScheduledNotification) => {
      update((notifications) => [...notifications, notification]);
    }
  };
}
