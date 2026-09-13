<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import Button from "@21n/elements/button/Button.svelte";
  import Text from "@21n/elements/text/Text.svelte";
  import InlineFeedbackText from "@nucleum/extensions/clipper/InlineFeedbackText.svelte";

  import { Action } from "@nucleum/client/config/action.enum";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import { TimeScaleUnit } from "@21n/utils/time.type";
  import { parseAndFormatDate } from "@21n/utils/time.utils";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import CalendarNotesPanel from "@nucleum/features/calendar/column/CalendarNotesPanel.svelte";
  import {
    AlertType,
    type IInlineStatus
  } from "@nucleum/stores/notifications/notification.type";
  import { setContext } from "svelte";
  import { Context } from "@nucleum/stores/appStore.type";
  import { Size } from "@21n/elements/size.enum";
  import { debouncer } from "@21n/utils/utils";
  import { generateSimpleRandomId } from "@21n/shared-utils/crypto.utils";
  import { resolveCalendarNotesId } from "@nucleum/features/calendar/calendar.utils";
  import { properCase } from "@21n/shared-utils/text.utils";

  let { date, scale }: { date: Date; scale: TimeScaleUnit } = $props();
  let mdId = generateSimpleRandomId();
  let feedback = $state<IInlineStatus | undefined>(undefined);

  function handleContentEvent(event: string, data: any) {
    debouncedShowFeedback(event);
  }

  const debouncedShowFeedback = debouncer(showFeedback, 1000);

  function showFeedback(event: string) {
    if (event === "start") {
      feedback = {
        message: "",
        type: AlertType.PROGRESS
      };
    } else if (event === "success") {
      feedback = {
        message: "",
        type: AlertType.PROGRESS
      };
      setTimeout(() => {
        feedback = {
          message: "Saved!",
          type: AlertType.SUCCESS
        };
      }, 600);
    } else if (event === "error") {
      feedback = {
        message: "Save failed",
        type: AlertType.ERROR
      };
    }
  }

  const calendarContentContext = {
    publish: handleContentEvent
  };

  setContext(Context.CALENDAR_CONTENT, calendarContentContext);

  function openNotesInFullScreen() {
    const id = resolveCalendarNotesId(date, scale);
    if (!id) return;
    navigation.openResource(id, AccessMode.POP);
  }
</script>

<div
  class="flex flex-col gap-2 h-full flex-grow w-full"
  id="mdcontainer-{mdId}"
>
  <div class="flex justify-between px-12 pt-3">
    <div class="flex items-center gap-2 whitespace-nowrap">
      <Text
        content={parseAndFormatDate(
          date,
          scale === TimeScaleUnit.DAY
            ? "verbose"
            : scale === TimeScaleUnit.MONTH
              ? "mmm-yyyy"
              : scale === TimeScaleUnit.WEEK
                ? "week-yyyy"
                : "yyyy"
        )}
        style={TextStyle.PANEL_HEADING_SMALL}
        isPreventProperCasing={scale === TimeScaleUnit.WEEK}
      />
      <span class="text-b2 text-fgs3">| {properCase(scale)} Notes </span>
      <InlineFeedbackText {feedback} size={Size.sm} />
    </div>
    <div class="flex items-center">
      <Button
        icon="fullscreen"
        tooltip="Open notes in full screen"
        onclick={openNotesInFullScreen}
      />
      <Button
        icon="history"
        tooltip="History"
        onclick={() => {
          navigation.openResource(Action.HISTORY, AccessMode.POP, {
            searchParams: { [AppSearchParam.DATE]: date.toISOString() }
          });
        }}
      />
    </div>
  </div>
  <div class="px-1 flex-grow">
    <CalendarNotesPanel {date} {scale} {mdId} />
  </div>
</div>
