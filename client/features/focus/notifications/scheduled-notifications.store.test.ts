import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { postMessageToParent } from "@nucleum/client/runtime/embed/embed.utils";
import { EmbedMessage } from "@nucleum/client/runtime/embed/embedMessage.enum";

vi.mock("@nucleum/client/runtime/embed/embed.utils", () => ({
  postMessageToParent: vi.fn()
}));

import {
  scheduledNotifications,
  type ScheduledNotification
} from "./scheduled-notifications.store";

describe("scheduledNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scheduledNotifications.set([]);
  });

  it("clears pending reminders and native notifications on reset", () => {
    scheduledNotifications.push({
      id: "reminder",
      inSeconds: 60,
      message: "Break",
      timestamp: 1
    });
    scheduledNotifications.reset();
    expect(get(scheduledNotifications)).toEqual([]);
    expect(postMessageToParent).toHaveBeenCalledOnce();
    expect(postMessageToParent).toHaveBeenCalledWith(
      EmbedMessage.CLEAR_NOTIFICATIONS
    );
  });

  it("replaces pending reminders on notify", () => {
    scheduledNotifications.push({
      id: "old",
      inSeconds: 60,
      message: "Break",
      timestamp: 1
    });
    const reminders = [
      { id: "new", inSeconds: 120, message: "Focus", timestamp: 2 }
    ];
    scheduledNotifications.notify(reminders);
    expect(get(scheduledNotifications)).toEqual(reminders);
    expect(postMessageToParent).not.toHaveBeenCalled();
  });

  it("preserves previously emitted snapshots when appending a notification", () => {
    const first: ScheduledNotification = {
      id: "first",
      inSeconds: 60,
      message: "First reminder",
      timestamp: 1
    };
    const second: ScheduledNotification = {
      id: "second",
      inSeconds: 120,
      message: "Second reminder",
      timestamp: 2
    };
    scheduledNotifications.set([first]);
    const priorSnapshot = get(scheduledNotifications);

    scheduledNotifications.push(second);

    expect(priorSnapshot).toEqual([first]);
    expect(get(scheduledNotifications)).toEqual([first, second]);
    expect(get(scheduledNotifications)).not.toBe(priorSnapshot);
  });
});
