<svelte:options runes={true} />

<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { onMount } from "svelte";

  import { pointronPreferences } from "@nucleum/features/focus/preferences.store";
  import { appEvents } from "@nucleum/stores/events/app-events.store";
  import type { IEvent } from "@21n/elements/input/event.type";
  import { PointronEvent } from "@nucleum/client/config/events/focus-event.enum";
  import { postNotificationToParent } from "@nucleum/client/runtime/embed/embed.utils";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { PointronAction } from "@nucleum/client/config/focus-action.enum";
  import context from "@nucleum/stores/context.store";
  import { GlobalEvent } from "@nucleum/stores/notifications/event.enum";

  let src = $state<string | null>(null);
  let body: string = "";
  let audio: any;

  onMount(() => {
    const pointronEventSub = appEvents.subscribe((event: IEvent) => {
      if (event.event === GlobalEvent.NONE) return;
      src = null;
      switch (event.event) {
        case PointronEvent.BREAK_ENDED:
          src = $pointronPreferences.breakEndSound ?? "/sounds/ping.wav";
          requireCommandHost().runAction(
            PointronAction.PREDEFINED_INTERVAL_NOTIFIER_OVERLAY
          );
          body = "Break ended";
          break;
        case PointronEvent.INTERVAL_ENDED:
          src = $pointronPreferences.focusEndSound ?? "/sounds/ping.wav";
          requireCommandHost().runAction(
            PointronAction.PREDEFINED_INTERVAL_NOTIFIER_OVERLAY
          );
          body = "Interval ended";
          break;
        case PointronEvent.BREAK_REMINDER:
          src = $pointronPreferences.focusEndSound ?? "/sounds/ping.wav";
          body = "Interval time limit reached";
          requireCommandHost().runAction(PointronEvent.BREAK_REMINDER);
          break;
        // case PointronEventEnum.PREDEFINED_INTERVAL_NOTIFIER:
        //   runAction(PointronEventEnum.PREDEFINED_INTERVAL_NOTIFIER);
        //   break;
        case PointronEvent.SESSION_FINISHED:
          src =
            $pointronPreferences.sessionFinishSound ?? "/sounds/dingding.mp3";
          requireCommandHost().runAction(PointronEvent.SESSION_FINISHED);
          break;
        case PointronEvent.SESSION_TIME_IS_UP:
          src =
            $pointronPreferences.sessionFinishSound ?? "/sounds/dingding.mp3";
          body = "Session finished";
          break;
      }
      if (!src) return;
      try {
        setTimeout(() => {
          postNotificationToParent({
            message: "",
            sound: src ? src.split("/sounds/")[1] : ""
          });
          if (!$context.isEmbed) {
            logger.log({ context: "playing sound", event, src });
            audio?.play();
          }
        }, 200);
      } catch (e) {
        console.error("Error in playing sound - Notifications", e);
      }
    });
    return () => {
      pointronEventSub();
    };
  });
</script>

<audio bind:this={audio} {src} />
