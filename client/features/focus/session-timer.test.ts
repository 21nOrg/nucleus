import "fake-indexeddb/auto";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
let activeSession: typeof import("./session.store").activeSession;
import { SessionType } from "./logs/log.type";
import { BlockType } from "./session.type";
import { SessionState } from "./sessionState.enum";
import { SessionCompositionType } from "./sessionComposition.type";
import { appEvents } from "@nucleum/stores/events/app-events.store";
import { configureCommandHost } from "@nucleum/stores/commands/command-host";
import { configureOverlayHost } from "@nucleum/stores/overlays/modal.store";

vi.mock("@nucleum/client/runtime/embed/embed.utils", async (original) => ({
  ...(await original<
    typeof import("@nucleum/client/runtime/embed/embed.utils")
  >()),
  postMessageToParent: vi.fn(),
  postDataToParent: vi.fn()
}));

beforeAll(async () => {
  configureOverlayHost({
    onDismiss: vi.fn(),
    openFullscreen: vi.fn(),
    closeFullscreen: vi.fn(),
    resolvePlayer: () => undefined
  });
  activeSession = (await import("./session.store")).activeSession;
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-12T12:00:10Z"));
  configureCommandHost({
    resolveAction: () => null,
    runAction: vi.fn(),
    runResourceAction: vi.fn()
  });
  configureOverlayHost({
    onDismiss: vi.fn(),
    openFullscreen: vi.fn(),
    closeFullscreen: vi.fn(),
    resolvePlayer: () => undefined
  });
  vi.spyOn(activeSession as any, "persist").mockResolvedValue(undefined);
  vi.spyOn(activeSession as any, "refreshNotifications").mockReturnValue(0);
  vi.spyOn(
    activeSession as any,
    "_postNotificationsToEmbed"
  ).mockImplementation(() => {});
});

afterEach(() => {
  activeSession.shallowReset();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("focus timer lifecycle", () => {
  it("keeps a target-focus break running with one timer at an exact boundary", async () => {
    const events = vi.spyOn(appEvents, "publish");
    await activeSession.modify(
      {
        ...activeSession.get(),
        type: SessionType.COUNTDOWN,
        composition: {
          ...activeSession.get().composition,
          type: SessionCompositionType.TARGET_FOCUS
        },
        start: new Date(Date.now() - 10000),
        currentBlockId: "focus",
        state: SessionState.FOCUS_RUNNING,
        isSessionRunning: true,
        totalIdle: 0,
        timeElapsed: 10,
        totalElapsed: 10,
        plannedDuration: 60,
        intervals: [
          {
            id: "focus",
            type: BlockType.FOCUS,
            start: Date.now() - 10000,
            duration: 60,
            progress: 0
          }
        ]
      },
      { isPersist: false }
    );
    await activeSession.startBreak();
    expect(activeSession.get().state).toBe(SessionState.BREAK_RUNNING);
    expect(events).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(activeSession.get().state).toBe(SessionState.BREAK_RUNNING);
    expect(activeSession.get().timeElapsed).toBe(3);
    expect(vi.getTimerCount()).toBe(1);
    activeSession.shallowReset();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("advances a predefined interval without allocating a second timer", async () => {
    await activeSession.modify(
      {
        ...activeSession.get(),
        type: SessionType.PREDEFINED_INTERVALS,
        start: new Date(Date.now() - 9000),
        currentBlockId: "focus",
        state: SessionState.FOCUS_RUNNING,
        isSessionRunning: true,
        totalIdle: 0,
        intervals: [
          {
            id: "focus",
            type: BlockType.FOCUS,
            start: Date.now() - 9000,
            duration: 10,
            progress: 0
          },
          {
            id: "break",
            type: BlockType.BREAK,
            start: Date.now() + 1000,
            duration: 10,
            progress: 0
          }
        ]
      },
      { isPersist: false }
    );
    activeSession.resumeTimer(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(activeSession.get().currentBlockId).toBe("break");
    expect(activeSession.get().state).toBe(SessionState.BREAK_RUNNING);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(10000);
    expect(activeSession.get().isSessionRunning).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
