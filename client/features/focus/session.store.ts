import { requireCommandHost } from "@nucleum/stores/commands/command-host";
import { Resource } from "@nucleum/datafn/resource.enum";
import {
  type IActiveSessionStore,
  type ISessionInterval,
  BlockType,
  type IFocusItemsStore,
  type ICurrentFocusItem,
  type IFocusItem
} from "@nucleum/features/focus/session.type";
import {
  generateIntervalsFromComposition,
  getTotalsFromComposition,
  refreshPredefinedIntervalsStartTime,
  resolveSessionTimeSplit
} from "@nucleum/features/focus/composition.utils";
import { get, writable } from "svelte/store";
import { SessionState } from "@nucleum/features/focus/sessionState.enum";
import { pointronPreferences } from "@nucleum/features/focus/preferences.store";
import {
  SessionCompositionType,
  type SessionComposition,
  BreakCompositionType
} from "@nucleum/features/focus/sessionComposition.type";
import { appStore } from "@nucleum/stores/app.store";
import modalEvent, {
  fullScreen,
  player
} from "@nucleum/stores/overlays/modal.store";
import {
  toasts,
  fullPageLoadingScreen
} from "@nucleum/stores/notification.store";
import { appEvents } from "@nucleum/stores/events/app-events.store";
import { scheduledNotifications } from "./notifications/scheduled-notifications.store";
import { deepCopy, isValidArrayWithData } from "@21n/shared-utils/obj.utils";
import { AlertType } from "@nucleum/stores/notifications/notification.type";
import { generateResourceId } from "@nucleum/datafn/id.utils";
import type { IRecordId } from "@nucleum/schema/legacy/data.type";
import { logger } from "@nucleum/client/runtime/logging/logger";
import {
  SessionType,
  type ISessionCapture,
  type ISessionLogCapture
} from "@nucleum/features/focus/logs/log.type";
import { createSessionItemRelationRefs } from "@nucleum/features/focus/logs/session-items.utils";
import context from "@nucleum/stores/context.store";
import { PointronEvent } from "@nucleum/client/config/events/focus-event.enum";
import { PointronAction } from "@nucleum/client/config/focus-action.enum";
import { datafn } from "@nucleum/datafn/datafn.store";
import { advancedCompositionDraft } from "@nucleum/features/focus/advanced/composition/advancedCompositionDraft.store";
import { ObservableStore } from "@nucleum/stores/client.store";
import {
  determineResourceType,
  isSameResource,
  resourceInList
} from "@nucleum/datafn/resource.utils";
import {
  resolveTaskFocus,
  resolveTotalTaskTime
} from "@nucleum/features/focus/session.utils";
import { postDataToParent } from "@nucleum/client/runtime/embed/embed.utils";
import { generateSimpleRandomId } from "@21n/shared-utils/crypto.utils";
import {
  ObjectiveStatus,
  type IObjective
} from "@nucleum/features/focus/goals/goal.type";
import { resolveUnixTimestamp } from "@21n/shared-utils/time.utils";
import { toDateValue } from "@21n/utils/time.utils";
import { uiState } from "@nucleum/stores/uiState/uiState.store";
import { UIState } from "@nucleum/stores/uiState/uiState.type";
import { removeDuplicatesFilter } from "@nucleum/datafn/resource.utils";
import { EmbedDataMessage } from "@nucleum/client/runtime/embed/embedMessage.enum";
import { getUtcSafeDay } from "@21n/elements/datetime/datetime.utils";
import type { ITaskCapture } from "@nucleum/features/focus/tasks/task.type";
import { StoreDataType } from "@nucleum/schema/legacy/store-data-type.enum";

/** @deprecated */
export const todayFocusStore = initTodayFocus();

function initTodayFocus() {
  const { subscribe, set, update } = writable<{
    focus: number;
    streak: number;
  }>();
  return {
    subscribe,
    set,
    incrementTodayFocus: (x: number) => {
      update((n: { focus: number; streak: number }) => {
        n.focus += x;
        return n;
      });
    }
  };
}

/**
 * @deprecated - use preset name from preset item instead
 */
export const newPresetLabel = writable<string>("");

export const currentFocusItem = writable<ICurrentFocusItem | undefined>(
  undefined
);

const seedSessionStore: IActiveSessionStore = {
  currentSessionId: undefined,
  isQuickStartOn: false,
  type: SessionType.COUNTUP,
  state: SessionState.NOT_STARTED,
  timeElapsed: 0,
  totalElapsed: 0,
  totalIdle: 0,
  totalExtended: 0,
  plannedDuration: 0,
  intervals: [
    {
      id: generateSimpleRandomId(),
      start: new Date().getTime(),
      duration: 0.0001,
      progress: 1,
      type: BlockType.FOCUS
    }
  ],
  currentIdle: 0,
  isSessionRunning: false,
  currentBlockId: "",
  currentFocusItem: undefined,
  isBreakReminderNotified: false,
  composition: {
    totalDuration: 60 * 60,
    focusDuration: 60 * 60,
    breakDuration: 0,
    breakReminder: 0,
    numberOfBreaks: 1,
    type: SessionCompositionType.COUNTUP,
    id: "slider",
    breakType: BreakCompositionType.REMINDER
  }
};

class ActiveSessionStore extends ObservableStore<IActiveSessionStore> {
  timer: any;
  idleTimer: any;
  isInitialized = false;
  private hasPresentedRunningSessionUi = false;
  private signal = datafn.kv.signal<IActiveSessionStore>(
    Resource.pointSessionSnapshotv2,
    { defaultValue: { ...seedSessionStore } }
  );
  constructor() {
    super(Resource.pointSessionSnapshotv2, StoreDataType.KVO);
    this._set({ ...seedSessionStore });
    this.signal.subscribe((value) => {
      this.loader(value);
    });
  }
  propagateMessageToParent(n: IActiveSessionStore) {}

  protected persist(n: Partial<IActiveSessionStore> | undefined = undefined) {
    return datafn.kv.merge(
      Resource.pointSessionSnapshotv2,
      (n ?? this.get()) as Record<string, unknown>
    );
  }

  async modify(
    n: Partial<IActiveSessionStore>,
    params: {
      isPersist?: boolean;
      isDebouncedPersist?: boolean;
      isPreventCachingDefault?: boolean;
    } = {
      isPersist: true
    }
  ) {
    const current = this.get();
    const next = { ...current, ...n };
    this._set(next);
    if (params.isPreventCachingDefault) return;
    if (params.isDebouncedPersist) {
      return datafn.kv.merge(Resource.pointSessionSnapshotv2, n, {
        debounceMs: 3000
      });
    }
    if (params.isPersist) return this.persist(n);
  }

  private clearTimers() {
    clearInterval(this.timer);
    clearInterval(this.idleTimer);
  }

  shallowReset() {
    this.clearTimers();
    this.hasPresentedRunningSessionUi = false;
    fullScreen.hide(false);
    player.reset();
    scheduledNotifications.reset();
  }

  /**
   * Completely resets the session store
   * @returns brand new session store with seed values
   */
  reset() {
    logger.log("session store reset");
    this.shallowReset();
    modalEvent.hide(PointronEvent.SESSION_FINISHED);
    modalEvent.hide(PointronEvent.BREAK_REMINDER);
    let newSession: IActiveSessionStore = deepCopy(seedSessionStore);
    newSession.notes = undefined;
    newSession.composition.breakReminder =
      get(pointronPreferences)?.breakReminder;
    return newSession;
  }

  private refreshNotifications(session: IActiveSessionStore) {
    scheduledNotifications.set([]);
    let sessionTimeRemaining: number | undefined = undefined;
    if (session.type != SessionType.COUNTUP) {
      sessionTimeRemaining = session.plannedDuration - session.totalElapsed;
      scheduleSessionFinishNotification();
    }
    let timeRemainingToTakeBreak: number | undefined = undefined;

    if (
      session.type != SessionType.PREDEFINED_INTERVALS &&
      session.state === SessionState.FOCUS_RUNNING
    ) {
      const isBreakReminderNotified = scheduleBreakReminderNotification(
        session.isBreakReminderNotified === true
      );
      if (isBreakReminderNotified !== session.isBreakReminderNotified) {
        this.modify({ isBreakReminderNotified }, { isPersist: false });
      }
      return timeRemainingToTakeBreak;
    }
    if (session.type === SessionType.PREDEFINED_INTERVALS) {
      const currentBlockIndex = session.intervals.findIndex(
        (x) => x.id == session.currentBlockId
      );
      const currentBlock = session.intervals[currentBlockIndex];
      if (!currentBlock?.duration) return;

      const timeRemainingForNextInterval =
        currentBlock.duration - session.timeElapsed;
      if (!timeRemainingForNextInterval) return;
      const title = currentBlock.type === BlockType.FOCUS ? "Focus" : "Break";
      const next = currentBlock.type === BlockType.FOCUS ? "break" : "focus";
      scheduledNotifications.push({
        inSeconds: timeRemainingForNextInterval,
        message: `${title} ended. Starting ${next}.`,
        timestamp: new Date().getTime() + timeRemainingForNextInterval * 1000,
        title: title + " ended.",
        sound: "ping.wav",
        id: "breakReminder"
      });
    }

    /**
     * Schedules the session finish notification.
     */
    function scheduleSessionFinishNotification() {
      // if (sessionTimeRemaining < 0) this.clearTimers();
      // if (n.type == SessionType.COUNTDOWN && sessionTimeRemaining < 0) {
      //   n.state = SessionState.TIME_IS_UP;
      //   appEvents.publish(PointronEventEnum.SESSION_TIME_IS_UP);
      // } else if (
      //   n.type == SessionType.COUNTDOWN &&
      //   sessionTimeRemaining < get(pointronConstants).runningOutDuration &&
      //   (n.state == SessionState.FOCUS_RUNNING ||
      //     n.state == SessionState.TIME_IS_UP)
      // ) {
      //   n.state = SessionState.TIME_IS_RUNNING_OUT;
      // }
      if (!sessionTimeRemaining) return;
      scheduledNotifications.push({
        inSeconds: sessionTimeRemaining,
        message: "Session time is up. Please extend or finish the session",
        timestamp: new Date().getTime() + sessionTimeRemaining * 1000,
        title: "Focus session time is up",
        sound: "dingding.mp3",
        id: "timeIsUp"
      });
    }

    /**
     * Schedules the break reminder notification based on current composition or fallback to the user preferences.
     * @returns time remaining to take break in seconds
     *
     * TODO - remind if no break taken - for multiples of the reminder...
     */
    function scheduleBreakReminderNotification(isNotified: boolean = false) {
      let breakReminderSetting =
        session.composition.breakType === BreakCompositionType.REMINDER
          ? (session.composition?.breakReminder ??
            get(pointronPreferences)?.breakReminder)
          : undefined;
      if (!breakReminderSetting) return isNotified;
      timeRemainingToTakeBreak = breakReminderSetting - session.timeElapsed;
      if (timeRemainingToTakeBreak < 0 && !isNotified) {
        appEvents.publish(PointronEvent.BREAK_REMINDER);
        isNotified = true;
      }
      if (
        !breakReminderSetting ||
        isNotified ||
        !timeRemainingToTakeBreak ||
        (session.type != SessionType.COUNTUP &&
          sessionTimeRemaining &&
          sessionTimeRemaining < timeRemainingToTakeBreak)
      )
        return isNotified;
      scheduledNotifications.push({
        inSeconds: timeRemainingToTakeBreak,
        message:
          "Its been " +
          breakReminderSetting / 60 +
          " minute(s) since you took a break. Please consider taking a break.",
        timestamp: new Date().getTime() + timeRemainingToTakeBreak * 1000,
        title: "Break Reminder",
        sound: "ping.wav",
        id: "breakReminder"
      });
      return isNotified;
      // scheduledNotifications.push({
      //   inSeconds: timeRemainingToTakeBreak * 2,
      //   message:
      //     "Its been " +
      //     2 * (breakReminder / 60) +
      //     " minute(s) since you took a break. Please consider taking a break.",
      //   timestamp: new Date().getTime() + 2 * timeRemainingToTakeBreak * 1000,
      //   title: "Break Reminder",
      //   sound: "ping.wav",
      //   id: "breakReminderTwo",
      // });
    }
  }

  private _postNotificationsToEmbed() {
    const notifications = get(scheduledNotifications);
    postDataToParent(EmbedDataMessage.NOTIFICATIONS, notifications);
  }

  /**
   * Resume the session timer and sets everything related to timer including notifications, progress on interval bars, etc.
   * @param n current session store
   * @param options resume options - whether to persist or reset timer
   * @returns updated session store
   */
  private _resumeTimer(
    options: { isResetTimer?: boolean } = {
      isResetTimer: true
    }
  ) {
    let session = this.get();
    //TODO - check if this is needed
    if (options.isResetTimer) {
      this.modify({ timeElapsed: 0 });
    }
    this.clearTimers();
    if (session.type === SessionType.PREDEFINED_INTERVALS) {
      this._restorePredefinedSessionState(session);
    }
    let isFirstRun = true;
    const tick = () => {
      session = this.get();
      const sessionStart =
        resolveSessionDate(session.start) ??
        resolveSessionDate(session.intervals?.[0]?.start);
      if (!sessionStart) return;
      const currentTime = new Date().getTime();
      const totalIdle = Number.isFinite(session.totalIdle)
        ? session.totalIdle
        : 0;
      const totalElapsed = Math.max(
        0,
        (currentTime - sessionStart.getTime()) / 1000 - totalIdle
      );
      const currentBlock = session.intervals.find(
        (x) => x.id == session.currentBlockId
      );
      const blockStart =
        resolveSessionNumber(currentBlock?.start) || sessionStart.getTime();
      const timeElapsed = Math.max(0, (currentTime - blockStart) / 1000);
      const timeRemainingToTakeBreak = this.refreshNotifications(session);
      if (isFirstRun) this._postNotificationsToEmbed();
      let plannedDuration = session.plannedDuration;
      let end = session.end;
      if (
        session.type === SessionType.COUNTDOWN &&
        session.composition?.type == SessionCompositionType.TARGET_FOCUS &&
        currentBlock?.type === BlockType.BREAK
      ) {
        const currentBlockIndex = session.intervals.findIndex(
          (x) => x.id == session.currentBlockId
        );
        session.intervals[currentBlockIndex] = {
          ...session.intervals[currentBlockIndex],
          duration: timeElapsed
        };
        plannedDuration = getTotalsFromComposition({
          intervals: session.intervals
        })?.duration;
        end = this.resolveEndTime({
          start: sessionStart,
          composition: session.composition,
          plannedDuration
        });
      }
      const { intervals, isContinueSession } = this._refreshIntervalsProgress(
        session,
        {
          timeElapsed,
          totalElapsed
        }
      );
      this.modify(
        {
          start: sessionStart,
          totalElapsed,
          timeElapsed,
          timeRemainingToTakeBreak,
          plannedDuration,
          intervals,
          end
        },
        { isPreventCachingDefault: true }
      );
      isFirstRun = false;
      if (isContinueSession) this._continueSession();
    };
    tick();
    if (this.get().isSessionRunning) {
      this.timer = setInterval(tick, 1000);
    }
  }

  /**
   * Restores the state of the session for predefined intervals case.
   *
   * 500 milliseconds is substracted to increase reliability in cases of the excution of this method delegated from {@link _continueSession} method.
   *
   * @param session
   * @returns
   */
  private _restorePredefinedSessionState(session: IActiveSessionStore) {
    let currentInterval: ISessionInterval | undefined = undefined;
    const sessionStart = resolveSessionDate(session.start);
    if (!sessionStart) return;
    const intervals = refreshPredefinedIntervalsStartTime(
      session.intervals,
      sessionStart
    );
    const now = new Date().getTime();
    const bufferTime = 500;

    intervals.some((interval, index) => {
      if (
        interval.start - bufferTime <= now &&
        index === intervals.length - 1
      ) {
        logger.log("interval is last");
        currentInterval = interval;
        return true;
      }
      if (
        interval.start - bufferTime <= now &&
        intervals[index + 1]?.start - bufferTime > now
      ) {
        logger.log({ interval, index, nextOne: intervals[index + 1] });
        currentInterval = interval;
        return true;
      }
    });
    logger.log({ currentInterval, now });
    if (!currentInterval) return;
    currentInterval = currentInterval as ISessionInterval;
    this.modify(
      {
        intervals,
        currentBlockId: currentInterval.id,
        state:
          currentInterval.type === BlockType.FOCUS
            ? SessionState.FOCUS_RUNNING
            : SessionState.BREAK_RUNNING
      },
      { isPersist: false }
    );
  }

  /**
   * Continues the next interval in case of pre defined intervals.
   *
   * Advances predefined intervals without replacing the active timer.
   */
  private async _continueSession() {
    let session = this.get();
    if (session.type !== SessionType.PREDEFINED_INTERVALS) return;
    if (session.state == SessionState.FOCUS_RUNNING) {
      appEvents.publish(PointronEvent.INTERVAL_ENDED);
    } else {
      appEvents.publish(PointronEvent.BREAK_ENDED);
      this.modify({ isBreakReminderNotified: false }, { isPersist: false });
    }
    this._restorePredefinedSessionState(session);
    this.modify({ timeElapsed: 0 }, { isPersist: false });
    this.refreshNotifications(this.get());
    this._postNotificationsToEmbed();
    await this.persist();
  }

  /**
   * Calculates blocks and total duration of the session based on composition seelction.
   * @param n sessionStore
   * @returns blocks - updated sessionStore
   */
  onComposeComplete(isPersist: boolean = true) {
    const session = this.get();
    const composition = session.composition;
    if (!composition) return;
    let intervals: ISessionInterval[] = [];
    let sessionType = session.type;
    let plannedDuration = session.plannedDuration;
    if (composition && composition.type === SessionCompositionType.COUNTUP) {
      countup();
    } else if (
      composition &&
      composition.type != SessionCompositionType.SLIDER
    ) {
      if (
        (composition?.numberOfFocusRounds &&
          composition.numberOfFocusRounds > 100) ||
        (composition?.numberOfBreaks && composition.numberOfBreaks > 100)
      ) {
        toasts.trigger({
          message:
            "Too many rounds selected: " + composition.numberOfFocusRounds,
          type: AlertType.ERROR,
          id: generateSimpleRandomId(),
          callback: () => {
            composition.numberOfFocusRounds = 1;
            composition.numberOfBreaks = 1;
          }
        });
        return;
      }
      intervals = generateIntervalsFromComposition(composition, session.end);
      if (intervals.length > 1) sessionType = SessionType.PREDEFINED_INTERVALS;
      else if (intervals.length === 1) sessionType = SessionType.COUNTDOWN;
      plannedDuration = getTotalsFromComposition({
        intervals: intervals
      })?.duration;
    } else if (
      session.type === SessionType.COUNTDOWN &&
      session.plannedDuration
    ) {
      intervals = [
        {
          id: generateSimpleRandomId(),
          start: new Date().getTime(),
          duration: session.plannedDuration,
          progress: 0,
          type: BlockType.FOCUS
        }
      ];
    } else if (session.type === SessionType.COUNTUP) {
      countup();
    }
    if (!isValidArrayWithData(intervals)) {
      countup();
    }
    logger.log({
      context: "composeSession",
      blocks: intervals,
      sessionType,
      plannedDuration,
      currentBlockId: intervals[0].id
    });
    this.modify(
      {
        composition: deepCopy(composition),
        intervals: intervals,
        type: sessionType,
        plannedDuration,
        end: this.resolveEndTime({
          start: new Date(),
          composition,
          plannedDuration,
          end: session.end
        }),
        currentBlockId: intervals[0].id
      },
      { isPersist }
    );
    function countup() {
      intervals = [
        {
          id: generateSimpleRandomId(),
          start: new Date().getTime(),
          duration: 0.0001,
          progress: 1,
          type: BlockType.FOCUS
        }
      ];
      sessionType = SessionType.COUNTUP;
      plannedDuration = 0;
    }
  }

  /**
   * Resolves a stored session end timestamp.
   * Countup and target focus return undefined so the UI does not treat the
   * session as having a fixed end time.
   */
  resolveEndTime(n: {
    start: Date;
    composition: SessionComposition;
    plannedDuration: number;
    end?: Date;
  }) {
    if (!n.start) return;
    if (n.composition?.type == SessionCompositionType.END_TIME_FIXED) {
      return n.end;
    } else if (
      n.composition?.type == SessionCompositionType.TARGET_FOCUS ||
      n.composition?.type == SessionCompositionType.COUNTUP
    ) {
      return undefined;
    } else {
      return new Date(n.start.getTime() + n.plannedDuration * 1000);
    }
  }

  /**
   * @deprecated - not used anywhere
   * @param n
   * @returns
   */
  refreshSessionProgress(n: IActiveSessionStore) {
    if (n.type == SessionType.COUNTUP) return 100;
    if (!n.start || !n.end) return;
    return (
      (n.totalElapsed / ((n.end?.getTime() - n.start?.getTime()) / 1000)) * 100
    );
  }

  private _refreshIntervalsProgress(
    session: IActiveSessionStore,
    params: { timeElapsed: number; totalElapsed: number }
  ): {
    intervals: ISessionInterval[];
    isContinueSession: boolean;
  } {
    let isContinueSession = false;
    if (session.type == SessionType.COUNTUP) {
      if (session.intervals && session.intervals.length < 1)
        return { intervals: session.intervals, isContinueSession };
      const currentLastBar = session.intervals.pop();
      if (!currentLastBar)
        return { intervals: session.intervals, isContinueSession };
      let lastBar = {
        ...currentLastBar,
        duration: currentLastBar.start
          ? (new Date().getTime() - currentLastBar.start) / 1000
          : (currentLastBar.duration ?? 0) + params.timeElapsed
      };
      return { intervals: [...session.intervals, lastBar], isContinueSession };
    }
    let totalElapsedRemaining = +params.totalElapsed.toFixed(0);
    let newBars: Array<ISessionInterval> = [];
    session.intervals.forEach((bar) => {
      let barDuration = bar.duration ?? 0;
      let refreshedProgress = 0;
      if (barDuration == totalElapsedRemaining) {
        refreshedProgress = 1;
        totalElapsedRemaining = 0;
        if (bar.id === session.currentBlockId) {
          const currentBlockIndex = session.intervals.findIndex(
            (x) => x.id == session.currentBlockId
          );
          if (currentBlockIndex === session.intervals.length - 1) {
            this.prefinishSession();
          } else if (session.type === SessionType.PREDEFINED_INTERVALS) {
            isContinueSession = true;
          }
        }
      } else if (barDuration < totalElapsedRemaining) {
        refreshedProgress = 1;
        totalElapsedRemaining = totalElapsedRemaining - barDuration;
      } else {
        refreshedProgress =
          1 - (barDuration - totalElapsedRemaining) / barDuration;
        totalElapsedRemaining = 0;
      }
      newBars = [...newBars, { ...bar, progress: refreshedProgress }];
    });
    if (totalElapsedRemaining > 0) {
      this.prefinishSession();
    }
    return { intervals: newBars, isContinueSession };
  }

  /**
   * Resumes the session from break state to focus state.
   * @returns
   */
  private async _resumeSession() {
    let session = this.get();
    if (session.state === SessionState.FOCUS_RUNNING) return;
    let intervals: ISessionInterval[] = [];
    let newBlockId = generateSimpleRandomId();
    let currentBlockId = newBlockId;
    const currentBlockIndex = session.intervals.findIndex(
      (x) => x.id == session.currentBlockId
    );
    const currentBlock = session.intervals[currentBlockIndex];
    if (session.type == SessionType.COUNTUP) {
      intervals = [
        ...session.intervals,
        {
          id: newBlockId,
          start: new Date().getTime(),
          duration: 0,
          progress: 1,
          type: BlockType.FOCUS
        }
      ];
    } else if (session.state === SessionState.BREAK_RUNNING) {
      intervals = session.intervals.slice(0, currentBlockIndex);
      intervals = [
        ...intervals,
        {
          ...currentBlock,
          duration: session.timeElapsed,
          progress: 1,
          type: BlockType.BREAK
        }
      ];
      if (
        session.type === SessionType.COUNTDOWN &&
        session.composition?.type !== SessionCompositionType.TARGET_FOCUS
      ) {
        intervals = [
          ...intervals,
          {
            id: newBlockId,
            start: new Date().getTime(),
            duration: currentBlock.duration - session.timeElapsed,
            progress: 0,
            type: BlockType.FOCUS
          }
        ];
      }
      intervals = intervals.concat(
        session.intervals.slice(currentBlockIndex + 1)
      );
      if (
        session.type === SessionType.COUNTDOWN &&
        session.composition?.type === SessionCompositionType.TARGET_FOCUS
      ) {
        currentBlockId = session.intervals[currentBlockIndex + 1]?.id;
        intervals[currentBlockIndex + 1].start = new Date().getTime();
      }
    }
    this.modify({
      intervals,
      currentBlockId,
      state: SessionState.FOCUS_RUNNING,
      isBreakReminderNotified: false
    });
    this._resumeTimer();
    return true;
  }

  /**
   *
   * Note: Not modifying `isQuickStartOn` state for finish session context as this is triggering refresh on QuickStart component and thus `isFinishingState` state on quick start thumbnail is being replaced which is not desirable.
   * @param props
   * @returns
   */
  private async _stopCurrentFocusItem(
    props: { isPersist?: boolean; isSessionFinish?: boolean; end?: number } = {
      isPersist: false
    }
  ) {
    let session = this.get();
    let currentFocus = get(currentFocusItem);
    if (!currentFocus) return;
    let end = props?.end ?? new Date().getTime();
    await focusItemsStore.appendFocusBlock(currentFocus.id, {
      start: currentFocus.start,
      end
    });
    currentFocusItem.set(undefined);
    return this.modify(
      {
        currentFocusItem: undefined,
        isQuickStartOn: props?.isSessionFinish ? session.isQuickStartOn : false
      },
      {
        isPersist: props.isPersist
      }
    );
  }

  async close() {
    logger.log({ context: "session store close" });
    focusItemsStore.reset(true);
    let session = this.reset();
    this.modify(session);
    // this.propagateMessageToParent(session);
    appEvents.publish(PointronEvent.SESSION_CLOSED);
    return session;
  }

  async loader(savedSessionStore: IActiveSessionStore) {
    if (!savedSessionStore || typeof savedSessionStore !== "object") return;
    this.isInitialized = true;
    logger.log({ context: "session store loader", savedSessionStore });
    savedSessionStore = normalizeSavedSessionStore(savedSessionStore);
    if (
      savedSessionStore.currentSessionId &&
      savedSessionStore.isSessionRunning
    ) {
      const currentValue = this.get();
      modalEvent.hide(PointronEvent.SESSION_FINISHED);
      this.presentRunningSessionUi(savedSessionStore);
      this.modify(
        {
          ...savedSessionStore,
          timeElapsed: currentValue.timeElapsed,
          totalElapsed: currentValue.totalElapsed
        },
        { isPersist: false }
      );
      if (savedSessionStore.currentFocusItem) {
        currentFocusItem.set(savedSessionStore.currentFocusItem);
      }
      this._resumeTimer({
        isResetTimer: false
      });
    } else if (
      savedSessionStore.state === SessionState.FINISHED ||
      savedSessionStore.state === SessionState.PRE_FINISHED
    ) {
      this.shallowReset();
      requireCommandHost().runAction(PointronEvent.SESSION_FINISHED);
      this.modify(savedSessionStore, { isPersist: false });
    } else {
      savedSessionStore = this.reset();
      this.modify(savedSessionStore, { isPersist: false });
    }
    this.propagateMessageToParent(savedSessionStore);
  }

  /**
   * Opens zen or the mini player for a restored running session once.
   */
  private presentRunningSessionUi(savedSessionStore: IActiveSessionStore) {
    if (this.hasPresentedRunningSessionUi) return;
    const isRestored =
      fullScreen.get()?.path === PointronAction.FULL_SCREEN_FOCUS ||
      fullScreen.restore();
    if (!isRestored) {
      if (savedSessionStore.isQuickStartOn) {
        player.showMini(PointronAction.FOCUS_PLAYER);
      } else {
        fullScreen.show(PointronAction.FULL_SCREEN_FOCUS);
      }
    }
    this.hasPresentedRunningSessionUi = true;
  }

  loadEmptyState() {
    logger.log({ context: "session store loadEmptyState" });
    this.modify(this.reset(), { isPersist: false });
    this.propagateMessageToParent(this.get());
  }

  /**
   * This is called when the session is auto finished without user interaction. This happens in cases of countdown or end time fixed sessions.
   *
   *Note:  This is used instead of finishSession directly as finishSession is causing unintented behavior when the app is left in the background or when the computer is in sleep state. In such cases, 100s of sessionLog entries are being created.
   */
  prefinishSession() {
    this.shallowReset();
    this.modify({
      state: SessionState.PRE_FINISHED,
      isSessionRunning: false
    });
    appEvents.publish(PointronEvent.SESSION_FINISHED);
  }

  private resolveEffectiveFinishEnd(end: number) {
    const session = this.get();
    const rawEnd = new Date(end);
    if (session.type === SessionType.COUNTUP) return rawEnd;
    const sessionEnd = resolveSessionDate(session.end);
    if (sessionEnd && rawEnd.getTime() > sessionEnd.getTime()) {
      return sessionEnd;
    }
    const sessionStart = resolveSessionDate(session.start);
    if (sessionStart && session.plannedDuration) {
      const plannedEnd = new Date(
        sessionStart.getTime() + session.plannedDuration * 1000
      );
      if (rawEnd.getTime() > plannedEnd.getTime()) return plannedEnd;
    }
    return rawEnd;
  }

  private resolveFinishedSession(end: Date): IActiveSessionStore {
    const session = this.get();
    const sessionStart = resolveSessionDate(session.start);
    const totalIdle = Number.isFinite(session.totalIdle)
      ? session.totalIdle
      : 0;
    const elapsed = sessionStart
      ? Math.max(0, (end.getTime() - sessionStart.getTime()) / 1000 - totalIdle)
      : session.totalElapsed;
    const intervals = this.resolveFinishedIntervals(session, end, elapsed);
    const currentBlock = intervals.find((x) => x.id === session.currentBlockId);
    const blockStart = resolveSessionNumber(currentBlock?.start);
    const timeElapsed = blockStart
      ? Math.max(0, (end.getTime() - blockStart) / 1000)
      : session.timeElapsed;
    return {
      ...session,
      end,
      intervals,
      totalElapsed: elapsed,
      timeElapsed,
      isSessionRunning: false,
      state: SessionState.FINISHED,
      currentFocusItem: undefined,
      isQuickStartOn: false
    };
  }

  private resolveFinishedIntervals(
    session: IActiveSessionStore,
    end: Date,
    totalElapsed: number
  ) {
    if (session.type === SessionType.COUNTUP) {
      const intervals = [...session.intervals];
      const lastBar = intervals.pop();
      if (!lastBar) return intervals;
      return [
        ...intervals,
        {
          ...lastBar,
          duration: lastBar.start
            ? Math.max(0, (end.getTime() - lastBar.start) / 1000)
            : lastBar.duration
        }
      ];
    }
    let remaining = Math.max(0, totalElapsed);
    return session.intervals.map((bar) => {
      const duration = bar.duration ?? 0;
      if (duration <= 0) return { ...bar, progress: bar.progress ?? 0 };
      if (remaining >= duration) {
        remaining = remaining - duration;
        return { ...bar, progress: 1 };
      }
      const progress = remaining / duration;
      remaining = 0;
      return { ...bar, progress };
    });
  }

  async finishSession(params?: {
    isClose?: boolean;
    isQuickStartSwitch?: boolean;
  }) {
    let session = this.get();
    let currentFocus = get(currentFocusItem);
    let finishedSession: IActiveSessionStore | undefined;
    if (!session.isQuickStartOn)
      fullPageLoadingScreen.show("Finishing session...");
    try {
      const now = new Date().getTime();
      const end = this.resolveEffectiveFinishEnd(now);
      if (currentFocus)
        await this._stopCurrentFocusItem({
          isSessionFinish: true,
          end: end.getTime()
        });
      // let lastBlock = n.intervals?.pop();
      // if (lastBlock) {
      //   lastBlock.end = now;
      //   n.intervals = [...(n.intervals ?? []), lastBlock];
      // }
      // n.blocks = [...n.blocks, { start: now, duration: 0, progress: 1 }];
      // session.state = SessionState.FINISHED;
      // session.isSessionRunning = false;
      finishedSession = this.resolveFinishedSession(end);
      this.modify(finishedSession, { isPersist: false });
      await sessionStore.finishFocus({ end: end.getTime() });
    } catch (err) {
      logger.error({ at: "finishSession", error: err });
    } finally {
      if (params?.isClose) {
        this.close();
      } else if (!params?.isQuickStartSwitch) {
        this.shallowReset();
        // this.propagateMessageToParent(session);
        currentFocusItem.set(undefined);
        this.modify(
          finishedSession ?? {
            isSessionRunning: false,
            state: SessionState.FINISHED,
            currentFocusItem: undefined,
            isQuickStartOn: false
          }
        );
        appEvents.publish(PointronEvent.SESSION_FINISHED);
      }
      fullPageLoadingScreen.hide();
    }
    return finishedSession ?? session;
  }

  async startTask(id: IRecordId) {
    let session = this.get();
    let currentFocus = get(currentFocusItem);
    if (currentFocus) await this._stopCurrentFocusItem();
    const newFocus = { start: new Date().getTime(), id };
    currentFocusItem.set(newFocus);
    this.modify(
      { currentFocusItem: newFocus },
      { isPersist: session.state != SessionState.BREAK_RUNNING }
    );
    if (session.state === SessionState.BREAK_RUNNING) {
      await this._resumeSession();
    }
  }

  async stopCurrentFocusItem() {
    await this._stopCurrentFocusItem({ isPersist: true });
  }

  resumeTimer(isResetTimer: boolean = true) {
    return this._resumeTimer({ isResetTimer });
  }

  async startBreak() {
    let session = this.get();
    if (session.state === SessionState.BREAK_RUNNING) return false;
    let intervals: ISessionInterval[] = [];
    let newBlockId = generateSimpleRandomId();
    if (session.type == SessionType.COUNTUP) {
      intervals = [
        ...session.intervals,
        {
          id: newBlockId,
          start: new Date().getTime(),
          duration: 0,
          progress: 1,
          type: BlockType.BREAK
        }
      ];
    } else if (
      session.type === SessionType.COUNTDOWN ||
      session.state === SessionState.FOCUS_RUNNING
    ) {
      intervals = resolveBlocksForCountdown();
    }

    this.modify({
      intervals,
      currentBlockId: newBlockId,
      state: SessionState.BREAK_RUNNING,
      isBreakReminderNotified: true
    });
    this._resumeTimer();
    return true;

    function resolveBlocksForCountdown() {
      let blocks: ISessionInterval[] = [];
      const currentBlockIndex = session.intervals.findIndex(
        (x) => x.id == session.currentBlockId
      );
      const currentBlock = session.intervals[currentBlockIndex];
      blocks = session.intervals.slice(0, currentBlockIndex);
      blocks = [
        ...blocks,
        {
          ...currentBlock,
          duration: session.timeElapsed,
          progress: 1,
          type: BlockType.FOCUS
        }
      ];
      if (
        session.type == SessionType.COUNTDOWN &&
        session.composition?.type == SessionCompositionType.TARGET_FOCUS
      ) {
        blocks = [
          ...blocks,
          {
            id: newBlockId,
            start: new Date().getTime(),
            duration: 0,
            progress: 0,
            type: BlockType.BREAK
          },
          {
            id: generateSimpleRandomId(),
            duration: currentBlock.duration - session.timeElapsed,
            progress: 0,
            start: new Date().getTime(),
            type: BlockType.FOCUS
          }
        ];
      } else {
        blocks = [
          ...blocks,
          {
            id: newBlockId,
            start: new Date().getTime(),
            duration: currentBlock.duration - session.timeElapsed,
            progress: 0,
            type: BlockType.BREAK
          }
        ];
      }
      let remainingBars = session.intervals.slice(currentBlockIndex + 1);
      blocks = blocks.concat(remainingBars);
      return blocks;
    }
  }

  async resumeSession() {
    await this._resumeSession();
  }

  clearIntervals() {
    this.clearTimers();
  }

  /**
   * @deprecated - extend session is not supported
   */
  async extendSession() {
    let extendDurationSetting = get(pointronPreferences).extendDuration * 60;
    let n = this.get();
    n.totalExtended = n.totalExtended + extendDurationSetting;
    n.plannedDuration = n.plannedDuration + extendDurationSetting;
    if (!n.plannedDuration || !n.start) return n;
    n.end = this.resolveEndTime({
      start: n.start,
      composition: n.composition,
      plannedDuration: n.plannedDuration,
      end: n.end
    });
    let currentLastBar = n.intervals.pop();
    if (currentLastBar) {
      let lastBar = {
        ...currentLastBar,
        duration: currentLastBar.duration + extendDurationSetting
      };
      n.intervals = [...n.intervals, lastBar];
    }
    this.modify(n, { isPersist: false });
    if (n.state === SessionState.TIME_IS_UP) {
      await this._resumeTimer({ isResetTimer: false });
    }
  }

  /**
   *
   * 1 ms buffer is added to currentFocus start to avoid task time calculation issue for predefined interval sessions. (The first item is not being shown with time incremented)
   *
   * @param isQuickStart
   * @returns
   */
  async startSession(isQuickStart: boolean = false) {
    const advancedDraft = get(advancedCompositionDraft);
    if (!isQuickStart && advancedDraft) {
      this.modify(
        { composition: deepCopy(advancedDraft) },
        { isPersist: false }
      );
    }
    this.onComposeComplete(false);
    if (isQuickStart) player.showMini(PointronAction.FOCUS_PLAYER);
    else fullScreen.show(PointronAction.FULL_SCREEN_FOCUS);
    this.hasPresentedRunningSessionUi = true;
    if (get(pointronPreferences).isEnableAutoPiP) {
      player.togglePip(PointronAction.FOCUS_PLAYER);
    }

    if (!get(context).isEmbed && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
    const sessionId = generateResourceId(Resource.session);
    let currentFocus = get(currentFocusItem);
    let focusItems = focusItemsStore.get();
    if (!isQuickStart && focusItems.items.length > 0) {
      const item = focusItems.items.find(
        (x) => !x.tasks || x.tasks.length === 0
      );
      if (item) {
        currentFocus = {
          id: item.id,
          start: new Date().getTime() + 1
        };
        currentFocusItem.set(currentFocus);
      }
    }
    this.modify(
      {
        currentSessionId: sessionId,
        isSessionRunning: true,
        start: new Date(),
        state: SessionState.FOCUS_RUNNING,
        isBreakReminderNotified: false,
        currentFocusItem: currentFocus
      },
      { isPersist: false }
    );
    this._resumeTimer();
    await this.persist(undefined);
    return true;
  }

  isCurrentFocusItem(id: IRecordId, currentFocusItemParam?: ICurrentFocusItem) {
    if (!this.get().isSessionRunning) return false;
    const currentFocus = currentFocusItemParam ?? get(currentFocusItem);
    if (!currentFocus) return false;
    const resourceTypeOfCurrentFocus = determineResourceType(currentFocus.id);
    const resourceTypeOfItem = determineResourceType(id);
    if (
      resourceTypeOfCurrentFocus === Resource.objective ||
      resourceTypeOfItem === Resource.task
    ) {
      return isSameResource(id, currentFocus);
    } else if (resourceTypeOfCurrentFocus === Resource.task) {
      const correspondingObjective = get(focusItemsStore).items.find((x) =>
        x.tasks?.some(resourceInList(currentFocus))
      );
      if (correspondingObjective) {
        return isSameResource(correspondingObjective.id, id);
      }
      return false;
    }
  }

  async focusObjective(objectiveId: IRecordId) {
    if (this.isCurrentFocusItem(objectiveId)) return;
    const session = this.get();
    if (session.isSessionRunning && !session.isQuickStartOn) {
      await focusItemsStore.addObjective(objectiveId);
      await this.startTask(objectiveId);
    } else {
      await this.quickStart(objectiveId);
    }
  }

  async focusTask(taskId: IRecordId, objectiveId?: IRecordId) {
    if (this.isCurrentFocusItem(taskId)) return;
    try {
      await focusItemsStore.addTask(taskId, objectiveId);
    } catch (err) {
      logger.error({ at: "focusTask", error: err });
    }
    const session = this.get();
    if (!session.isSessionRunning) {
      await this.startSession();
    }
    await this.startTask(taskId);
  }

  /**
   * Starts a quick start session for a given objective.
   * @param objectiveId
   */
  async quickStart(objectiveId: IRecordId) {
    if (this.get().isSessionRunning)
      await activeSession.finishSession({ isQuickStartSwitch: true });
    let n = this.reset();
    focusItemsStore.reset();
    try {
      let composition = {
        type: SessionCompositionType.COUNTUP,
        totalDuration: 0,
        focusDuration: 0,
        breakDuration: 0,
        numberOfBreaks: 0,
        breakReminder: get(pointronPreferences)?.breakReminder ?? 0,
        id: "slider",
        breakType: BreakCompositionType.REMINDER
      };
      const newFocus = { start: new Date().getTime(), id: objectiveId };
      currentFocusItem.set(newFocus);
      this.modify(
        {
          ...n,
          composition,
          type: SessionType.COUNTUP,
          end: undefined,
          plannedDuration: 0,
          isQuickStartOn: true,
          currentFocusItem: newFocus
        },
        { isPersist: false }
      );
      await focusItemsStore.addObjective(objectiveId);
      return this.startSession(true);
    } catch (err) {
      logger.error({ at: "quickStart", error: err });
    }
  }

  async onPresetSelection(preset: SessionComposition) {
    this.modify({ composition: deepCopy(preset) }, { isPersist: false });
    this.onComposeComplete();
    if (preset.objectives?.length) {
      await focusItemsStore.resetToPresetObjectives(preset.objectives);
    }
  }

  async resetComposition() {
    const composition = {
      id: generateSimpleRandomId(),
      type: SessionCompositionType.COUNTUP,
      focusDuration: 0,
      numberOfBreaks: 0,
      breakDuration: 5 * 60,
      totalDuration: 60 * 60,
      breakReminder: 60 * 60,
      breakType: BreakCompositionType.REMINDER
    };
    await this.modify({ composition, end: undefined }, { isPersist: false });
    this.onComposeComplete(false);
  }

  async saveCurrentCompositionAsPreset(params: {
    objectives: IRecordId[];
    name: string;
    composition?: SessionComposition;
  }) {
    let n = this.get();
    const composition = params.composition ?? n.composition;
    if (!composition) return;
    const result = await pointronPreferences.addPreset({
      ...deepCopy(composition),
      name: params.name,
      id: generateSimpleRandomId(),
      objectives: params.objectives
    });
    toasts.success("Preset saved successfully");
    return result;
  }

  /**
   * @deprecated - slider duration setting is deprecated
   * @param duration
   */
  async onSliderDurationChange(duration: number) {
    let n = this.get();
    if (duration === 0) {
      n.type = SessionType.COUNTUP;
      n.plannedDuration = 0;
    } else {
      n.plannedDuration = duration;
      n.type = SessionType.COUNTDOWN;
    }
    n.composition = {
      ...seedSessionStore.composition,
      type: SessionCompositionType.SLIDER,
      totalDuration: duration,
      focusDuration: duration
    };
    //TODO - debounced
    this.onComposeComplete();
  }

  async saveNotes() {
    this.persist({ notes: this.get().notes });
  }

  /**
   * Resolves the current focus item data.
   * @param item
   * @returns
   */
  async resolveCurrentFocusItemData(
    params: {
      item?: ICurrentFocusItem;
      isReturnObjectiveIfTask?: boolean;
    } = {}
  ) {
    let item = params.item;
    if (!item) item = get(currentFocusItem);
    if (!item) return;
    const resourceType = determineResourceType(item.id);
    if (resourceType === Resource.objective) {
      const objective = await datafn.objective.query({
        select: ["*", "children.*", "tasks.*"],
        filters: {
          id: item.id.toString()
        }
      });
      return objective.data?.[0];
    } else if (resourceType === Resource.task) {
      const task = await datafn.task.query({
        select: ["*", "objective.*"],
        filters: {
          id: item.id.toString()
        }
      });
      return task.data?.[0];
    }
  }
}
export const activeSession = new ActiveSessionStore();

function resolveSessionDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : undefined;
  }
  const fromKnown = toDateValue(
    value as Date | string | number | undefined | null
  );
  if (fromKnown) return fromKnown;
  if (value && typeof value === "object") {
    if (typeof (value as { getTime?: unknown }).getTime === "function") {
      const timestamp = (value as Date).getTime();
      if (Number.isFinite(timestamp)) return new Date(timestamp);
    }
    const record = value as Record<string, unknown>;
    for (const key of [
      "value",
      "date",
      "iso",
      "datetime",
      "$date",
      "epochMs",
      "ms"
    ]) {
      const nested = toDateValue(
        record[key] as Date | string | number | undefined | null
      );
      if (nested) return nested;
    }
    const parsed = new Date(String(value));
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  return undefined;
}

function normalizeSavedSessionStore(
  savedSessionStore: IActiveSessionStore
): IActiveSessionStore {
  const normalized = { ...savedSessionStore };
  const start = resolveSessionDate(savedSessionStore.start);
  if (start) {
    normalized.start = start;
  }
  const end = resolveSessionDate(savedSessionStore.end);
  if (end) {
    normalized.end = end;
  }
  normalized.intervals = Array.isArray(savedSessionStore.intervals)
    ? savedSessionStore.intervals.map((interval) => ({
        ...interval,
        start: resolveSessionNumber(interval?.start),
        duration: resolveSessionNumber(interval?.duration),
        progress: resolveSessionNumber(interval?.progress)
      }))
    : [];
  if (savedSessionStore.currentFocusItem) {
    normalized.currentFocusItem = {
      ...savedSessionStore.currentFocusItem,
      start: resolveSessionNumber(savedSessionStore.currentFocusItem.start)
    };
  }
  if (typeof savedSessionStore.timeElapsed !== "number") {
    normalized.timeElapsed = resolveSessionNumber(
      savedSessionStore.timeElapsed
    );
  }
  if (typeof savedSessionStore.totalElapsed !== "number") {
    normalized.totalElapsed = resolveSessionNumber(
      savedSessionStore.totalElapsed
    );
  }
  if (typeof savedSessionStore.plannedDuration !== "number") {
    normalized.plannedDuration = resolveSessionNumber(
      savedSessionStore.plannedDuration
    );
  }
  if (typeof savedSessionStore.totalIdle !== "number") {
    normalized.totalIdle = resolveSessionNumber(savedSessionStore.totalIdle);
  }
  if (typeof savedSessionStore.totalExtended !== "number") {
    normalized.totalExtended = resolveSessionNumber(
      savedSessionStore.totalExtended
    );
  }
  if (typeof savedSessionStore.currentIdle !== "number") {
    normalized.currentIdle = resolveSessionNumber(
      savedSessionStore.currentIdle
    );
  }
  if (
    savedSessionStore.timeRemainingToTakeBreak !== undefined &&
    typeof savedSessionStore.timeRemainingToTakeBreak !== "number"
  ) {
    normalized.timeRemainingToTakeBreak = resolveSessionNumber(
      savedSessionStore.timeRemainingToTakeBreak
    );
  }
  return normalized;
}

function resolveSessionNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }
  if (typeof value === "string") {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
    const dateValue = new Date(value).getTime();
    if (Number.isFinite(dateValue)) {
      return dateValue;
    }
  }
  if (value && typeof value === "object") {
    const timestamp = resolveSessionDate(value)?.getTime();
    if (timestamp && Number.isFinite(timestamp)) {
      return timestamp;
    }
  }
  return 0;
}

export const lastActiveObjectiveIdForEditing = writable<IRecordId | undefined>(
  undefined
);

const seedFocusItemsStore: IFocusItemsStore = {
  items: [],
  removedItems: []
};

class FocusItemsStore extends ObservableStore<IFocusItemsStore> {
  isInitialized = false;
  private signal = datafn.kv.signal<IFocusItemsStore>(
    Resource.sessionFocusItems,
    { defaultValue: { ...seedFocusItemsStore } }
  );

  constructor() {
    super(Resource.sessionFocusItems, StoreDataType.KVO);
    this._set({ ...seedFocusItemsStore });
    this.signal.subscribe((value) => {
      this.loader(value);
    });
  }

  loader(data: IFocusItemsStore) {
    if (!data.items) data.items = [];
    if (!data.removedItems) data.removedItems = [];
    this.isInitialized = true;
    this._set({ ...data });
  }

  async modify(
    n: Partial<IFocusItemsStore>,
    params: {
      isPersist?: boolean;
      isDebouncedPersist?: boolean;
      isPreventCachingDefault?: boolean;
    } = {
      isPersist: true
    }
  ) {
    const current = this.get();
    const next = { ...current, ...n };
    this._set(next);
    if (params.isPreventCachingDefault) return;
    if (params.isDebouncedPersist) {
      return datafn.kv.merge(Resource.sessionFocusItems, n, {
        debounceMs: 3000
      });
    }
    if (params.isPersist) {
      return datafn.kv.merge(
        Resource.sessionFocusItems,
        n as Record<string, unknown>
      );
    }
  }

  reset(isPersist: boolean = false) {
    logger.log({ context: "focus items store - reset" });
    this.modify(
      { items: [], removedItems: [] },
      {
        isPersist
      }
    );
  }

  async refreshRecents(items: { id: IRecordId; startUnix: number }[]) {
    const objectivesResult = await datafn.objective.query({
      select: ["*", "children.*", "tasks.*"],
      filters: {
        id: { $in: items.map((x) => x.id.toString()) },
        status: {
          $ne: ObjectiveStatus.COMPLETED
        }
      }
    });
    const newRecents = items
      .map((x) => {
        const objective = (
          objectivesResult.data as IObjective[] | undefined
        )?.find(resourceInList(x.id));
        if (!objective) return;
        return {
          id: x.id,
          item: objective,
          startUnix: x.startUnix
        };
      })
      .filter(
        (recent): recent is { id: string; item: any; startUnix: number } =>
          Boolean(recent && recent.id && recent.item)
      );
    this.modify({ recents: newRecents });
  }

  async addNewTask(label: string, objectiveId?: IRecordId) {
    let id = generateResourceId(Resource.task);
    await this.addTask(id, objectiveId);
    const task: ITaskCapture = {
      id,
      label,
      isChecked: false,
      dateUnix: resolveUnixTimestamp(getUtcSafeDay(new Date())),
      ...(objectiveId && { objectiveId })
    };
    appStore.addToRecents({
      record: task,
      type: Resource.task,
      timestamp: new Date()
    });
    await datafn.task.mutate({
      operation: "insert",
      id: id.toString(),
      record: task
    });
    return [task];
  }

  async addTask(id: IRecordId, objectiveId?: IRecordId) {
    let n = this.get();
    if (n.items.some(resourceInList(id)))
      throw new Error("Task already exists");
    let blocks:
      | {
          start: number;
          end: number;
        }[]
      | undefined = undefined;
    const removedTask = n.removedItems?.find(resourceInList(id));
    if (removedTask) {
      n.removedItems =
        n.removedItems?.filter((item) => !isSameResource(item, id)) ?? [];
      blocks = removedTask.blocks ?? [];
    }

    if (objectiveId && !n.items.some(resourceInList(objectiveId))) {
      const removedObjective = n.removedItems?.find(
        resourceInList(objectiveId)
      );
      if (removedObjective) {
        n.removedItems =
          n.removedItems?.filter(
            (item) => !isSameResource(item, objectiveId)
          ) ?? [];
        n.items.push({ ...removedObjective, tasks: [] });
      } else {
        n.items.push({ id: objectiveId, tasks: [], blocks: [] });
      }
    }

    this.modify({
      items: [
        ...(n.items.map((x: IFocusItem) => {
          if (objectiveId && isSameResource(x.id, objectiveId))
            x.tasks = [...(x.tasks ?? []), id];
          return x;
        }) ?? []),
        {
          id,
          tasks: [],
          blocks: [...(blocks ?? [])]
        }
      ]
    });
    if (objectiveId) lastActiveObjectiveIdForEditing.set(objectiveId);
  }

  async addObjective(id: IRecordId) {
    let n = this.get();
    if (n.items.some(resourceInList(id))) return;

    const removedObjective = n.removedItems?.find(resourceInList(id));
    if (removedObjective) {
      n.removedItems =
        n.removedItems?.filter((item) => !isSameResource(item, id)) ?? [];
      n.items.push(removedObjective);
    } else {
      n.items.push({ id, tasks: [], blocks: [] });
    }
    this.modify(n);
    lastActiveObjectiveIdForEditing.set(id);
  }
  async resetToPresetObjectives(ids: IRecordId[]) {
    let n = this.get();
    n.items = ids.map((id) => ({ id, tasks: [], blocks: [] }));
    this.modify(n);
    lastActiveObjectiveIdForEditing.set(ids[0]);
    appEvents.publish(PointronEvent.REFRESH_FOCUSITEMS);
  }

  async appendFocusBlock(id: IRecordId, block: { start: number; end: number }) {
    let n = this.get();
    const items = n.items.map((item) => {
      if (isSameResource(item.id, id)) {
        item.blocks = [...(item.blocks ?? []), block];
        return item;
      }
      return item;
    });
    return this.modify({ items });
  }

  async removeFocusItem(id: IRecordId) {
    let n = this.get();
    if (!n || n.items.length === 0) return;
    const removedItem = n.items.find((item) => isSameResource(item.id, id));
    if (!removedItem) return;
    const parentObjectiveId = n.items.find((item) =>
      item.tasks?.some(resourceInList(id))
    )?.id;

    if (!n.removedItems) n.removedItems = [];
    const itemsToRemove = n.items
      .filter(
        (item) =>
          isSameResource(item.id, id) ||
          removedItem.tasks?.some(resourceInList(item.id))
      )
      .map((item) =>
        isSameResource(item.id, id) && parentObjectiveId
          ? { ...item, parentObjectiveId }
          : item
      );
    n.removedItems.push(...itemsToRemove);

    n.items = n.items.filter(
      (item) =>
        !isSameResource(item.id, id) &&
        !removedItem.tasks?.some(resourceInList(item.id))
    );

    n.items = n.items.map((item) => {
      if (item.tasks && item.tasks?.length > 0) {
        item.tasks = item.tasks.filter((t) => !isSameResource(t, id));
      }
      return item;
    });

    this.modify(n);
  }

  async propagateDependencyChanges(data: any) {
    logger.log({
      context: "propagateDependencyChanges to focusItemsStore",
      data
    });
  }

  resolveCount(items: IFocusItem[]) {
    return items.length;
  }

  async rearrangeFocusItems(fromId: IRecordId, toId: IRecordId) {
    let n = this.get();
    if (
      !fromId ||
      !toId ||
      !n.items.some(resourceInList(fromId)) ||
      !n.items.some(resourceInList(toId))
    ) {
      return;
    }
    const items = [...n.items];
    const fromIndex = items.findIndex((item) =>
      isSameResource(item.id, fromId)
    );
    const toIndex = items.findIndex((item) => isSameResource(item.id, toId));
    const [movedItem] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, movedItem);
    this.modify({ items });
  }

  async rearrangeTasksInObjective(
    objectiveId: IRecordId,
    fromId: IRecordId,
    toId: IRecordId
  ) {
    let n = this.get();
    const objectiveItem = n.items.find(resourceInList(objectiveId));
    if (
      !objectiveItem ||
      !objectiveItem.tasks ||
      objectiveItem.tasks.length === 0
    ) {
      return;
    }
    const fromIndex = objectiveItem.tasks.findIndex(resourceInList(fromId));
    const toIndex = objectiveItem.tasks.findIndex(resourceInList(toId));
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= objectiveItem.tasks.length ||
      toIndex >= objectiveItem.tasks.length
    ) {
      return;
    }
    const tasks = [...objectiveItem.tasks];
    const [movedTask] = tasks.splice(fromIndex, 1);
    tasks.splice(toIndex, 0, movedTask);

    const items = n.items.map((item) => {
      if (isSameResource(item.id, objectiveId)) {
        return { ...item, tasks };
      }
      return item;
    });
    this.modify({ items });
  }
}

export const focusItemsStore = new FocusItemsStore();

function addToRecentFocusItems(logs: ISessionLogCapture[]) {
  const newEntries = logs
    .filter((x) => x.objectiveId && !x.taskId)
    .map((log) => ({
      id: log.objectiveId,
      startUnix: log.startUnix
    }));
  const newVal = [
    ...newEntries,
    ...(uiState.getState(UIState.recentFocusItems) ?? [])
  ]
    .filter(removeDuplicatesFilter)
    .slice(0, 15);
  uiState.setState(UIState.recentFocusItems, newVal);
  focusItemsStore.refreshRecents(newVal);
}

async function finishFocus(params?: { end?: number }) {
  const activeSessionVal = activeSession.get();
  const focusItemStore = focusItemsStore.get();
  const plannedEndTime = resolvePlannedEndTime(activeSessionVal);
  const endTime =
    plannedEndTime && new Date().getTime() > plannedEndTime.getTime()
      ? plannedEndTime
      : new Date(params?.end ?? new Date().getTime());

  const session: ISessionCapture = {
    elapsed: activeSessionVal.totalElapsed,
    extended: activeSessionVal.totalExtended,
    startUnix: activeSessionVal.start
      ? resolveUnixTimestamp(activeSessionVal.start)
      : 0,
    endUnix: resolveUnixTimestamp(endTime),
    plannedEndUnix: plannedEndTime
      ? resolveUnixTimestamp(plannedEndTime)
      : undefined,
    id:
      activeSessionVal.currentSessionId ?? generateResourceId(Resource.session),
    type: activeSessionVal.type,
    blocks: [
      ...activeSessionVal.intervals,
      {
        id: generateSimpleRandomId(),
        start: endTime.getTime(),
        type: BlockType.NONE,
        progress: 0,
        duration: 0
      }
    ],
    notes: activeSessionVal.notes
  };
  const logs: ISessionLogCapture[] = [];

  const allItems = [
    ...focusItemStore.items,
    ...(focusItemStore.removedItems ?? [])
  ];

  allItems.forEach((item: IFocusItem) => {
    const resourceType = determineResourceType(item.id);
    const objectiveId =
      resourceType === Resource.objective
        ? item.id
        : (item.parentObjectiveId ??
          allItems.find((x) => x.tasks?.some(resourceInList(item.id)))?.id ??
          "");
    const taskId = resourceType === Resource.task ? item.id : "";
    if (item.blocks && item.blocks.length > 0) {
      logs.push(
        ...item.blocks.map((block) => {
          return generateLogFromBlock(objectiveId, taskId, block);
        })
      );
    }
  });

  const totalTimeFromLogs = logs.reduce((acc, log) => {
    return acc + ((log.focus ?? 0) + (log.breakTime ?? 0));
  }, 0);

  const sessionTotals = resolveSessionTimeSplit(session);

  const remainingTime =
    sessionTotals.focus + sessionTotals.brek - totalTimeFromLogs;
  if (remainingTime > 0) {
    logs.push({
      id: generateResourceId(Resource.sessionLog),
      startUnix: session.startUnix,
      endUnix: session.endUnix,
      sessionId: session.id,
      focus: remainingTime,
      breakTime: 0
    });
  }
  await datafn.session.mutate([
    {
      operation: "insert",
      id: session.id,
      record: session,
      context: PointronAction.FINISH_FOCUS_SESSION
    },
    {
      operation: "relate",
      id: session.id,
      relations: {
        items: createSessionItemRelationRefs(allItems)
      },
      context: PointronAction.FINISH_FOCUS_SESSION
    }
  ]);
  await datafn.sessionLog.mutate(
    logs.map((record) => ({
      operation: "insert",
      id: record.id,
      record: {
        ...record,
        objectiveId: record.objectiveId ?? "",
        sessionId: record.sessionId ?? "",
        taskId: record.taskId ?? ""
      },
      context: PointronAction.FINISH_FOCUS_SESSION
    }))
  );
  addToRecentFocusItems(logs);

  function resolvePlannedEndTime(session: IActiveSessionStore) {
    if (session.type == SessionType.COUNTUP) {
      return;
    } else if (session.end) return session.end;
    else if (session.start) {
      return new Date(session.start.getTime() + session.plannedDuration * 1000);
    }
  }

  function generateLogFromBlock(
    objectiveId: IRecordId,
    taskId: IRecordId,
    block: { start: number; end: number }
  ): ISessionLogCapture {
    const total = resolveTotalTaskTime([block]);
    const focus = resolveTaskFocus(session.blocks, [block]);
    const breakTime = Number((total - focus).toFixed(1));
    logger.log({
      focus,
      blocks: deepCopy(session.blocks),
      total,
      block,
      breakTime
    });
    return {
      id: generateResourceId(Resource.sessionLog),
      startUnix: resolveUnixTimestamp(new Date(block.start)),
      endUnix: resolveUnixTimestamp(new Date(block.end)),
      sessionId: session.id,
      objectiveId,
      taskId,
      focus,
      breakTime
    };
  }
}

export const sessionStore = {
  addToRecentFocusItems,
  finishFocus
};
