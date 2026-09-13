import {
  GlobalEvent,
  type Event
} from "@nucleum/stores/notifications/event.enum";
import type { IEvent } from "@21n/elements/input/event.type";
import { ObservableStore } from "@nucleum/stores/client.store";
import { dispatchCustomEvent } from "@21n/utils/browser.utils";

/** Application events shared across layout, controls, and capabilities. */
class AppEventStore extends ObservableStore<IEvent> {
  constructor() {
    super("appEvents");
    this.reset();
  }
  reset() {
    this.set({ event: GlobalEvent.NONE, value: false });
  }
  publish(m: Event, value: any = undefined) {
    this.update((n: IEvent) => {
      return { event: m, value };
    });
    this.reset();
    if (typeof window !== "undefined") {
      dispatchCustomEvent(GlobalEvent.EVENT, {
        event: m,
        value
      });
    }
  }

  nav(path: string) {
    this.publish(GlobalEvent.NAV, { path });
  }
}

export const appEvents = new AppEventStore();
