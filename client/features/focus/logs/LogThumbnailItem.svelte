<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { PointronAction } from "@nucleum/client/config/focus-action.enum";
  import Divider from "@21n/elements/Divider.svelte";
  import Icon from "@21n/elements/Icon.svelte";
  import Text from "@21n/elements/text/Text.svelte";

  import { userPreferences } from "@nucleum/stores/preferences/user-preferences.store";
  import view from "@nucleum/stores/view.store";
  import { Orientation } from "@21n/elements/direction.enum";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import { ColorStrength } from "@21n/theme/appearance.type";
  import { resolveHoverState } from "@21n/utils/browser.utils";
  import { formatSeconds, formatTime } from "@21n/utils/time.utils";
  import type { ISessionThumb } from "@nucleum/features/focus/logs/log.type";
  import { cn } from "@21n/utils/ui.utils";
  import HoverableElement from "@21n/elements/HoverableElement.svelte";
  import LogThumbnailObjectivesInfo from "@nucleum/features/focus/logs/LogThumbnailGoalsInfo.svelte";

  let {
    session,
    context = "logs",
    isLast = false,
    variant = "v1",
    onclick = undefined
  }: {
    session: ISessionThumb & {
      splits: { focus: number; brek: number };
    };
    context?: "journal" | "logs";
    isLast?: boolean;
    variant?: "v1" | "v2";
    onclick?: ((event: MouseEvent) => void) | undefined;
  } = $props();
  let isEnableVariableHeight: boolean = true;
  let isHovering: boolean = false;
  const minHeight = 60;
  let total = $derived(session.splits.focus + session.splits.brek);
  let height = $derived.by(() => {
    if (!isEnableVariableHeight) return 120;
    if (total <= 60) return minHeight;
    if (total <= 600) return minHeight + 10;
    if (total <= 1200) return minHeight + 20;
    if (total <= 1800) return minHeight + 30;
    if (total <= 2400) return minHeight + 40;
    if (total <= 3000) return minHeight + 50;
    if (total <= 3600) return minHeight + 60;
    if (total <= 7200) return minHeight + 70;
    if (total <= 10800) return minHeight + 80;
    if (total <= 14400) return minHeight + 90;
    return minHeight + 100;
  });

  async function handleDelete(event: MouseEvent) {
    requireCommandHost().runAction(PointronAction.DELETE_SESSION, {
      componentParams: { id: session.id }
    });
    event.stopPropagation();
  }
  const toggleHoveringState = (event: MouseEvent | FocusEvent) => {
    isHovering = resolveHoverState(event);
  };
</script>

<HoverableElement
  bind:isHovering
  id="log-item"
  class={cn(
    "relative flex w-full gap-2 items-center rounded-md border border-brs3 p-4 cursor-pointer userdata",
    {
      "mb-10": isLast
    }
  )}
  style="min-height: {height}px;"
  {onclick}
>
  <div
    class={cn(
      "flex h-full flex-col justify-between items-start gap-1 rounded-l-md text-b2",
      {
        "w-[31%]": variant === "v1" && $view.isPortrait,
        "w-[28%]": variant === "v1" && !$view.isPortrait,
        "pr-8 w-1/4": variant === "v2"
      }
    )}
  >
    <div
      class={cn({
        "text-b3 text-fgs2": variant === "v2",
        "mo:text-b2 text-b3 text-fgs3": variant === "v1"
      })}
    >
      {formatTime($userPreferences, new Date(session.startUnix))}
    </div>
    <div class="flex h-full gap-2">
      <Divider
        orientation={Orientation.Vertical}
        colorStrength={ColorStrength.Strong}
      />
      {#if variant === "v1"}
        <div class="flex h-full text-start items-center gap-2">
          <div class="flex flex-col gap w-ful text-fgs2">
            {#if isEnableVariableHeight && height < 140}
              <div class="min-w-fit text-fgs1 text-b4">
                {formatSeconds(total)}
              </div>
            {:else}
              <div class="min-w-fit text-aps1 text-b3">
                F:
                {formatSeconds(session.splits.focus)}
              </div>
              <div class="min-w-fit text-ass1 text-b3">
                B:
                {formatSeconds(session.splits.brek)}
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
    <div
      class={cn({
        "text-b3 text-fgs2": variant === "v2",
        "mo:text-b2 text-b3 text-fgs3": variant === "v1"
      })}
    >
      {formatTime($userPreferences, new Date(session.endUnix))}
    </div>
  </div>
  <div
    class={cn("flex flex-col h-full gap-1", {
      "w-[69%]": variant === "v1" && $view.isPortrait,
      "w-[72%]": variant === "v1" && !$view.isPortrait
    })}
  >
    <div class="flex-grow flex flex-col items-start gap-2 overflow-y-auto">
      {#if variant === "v1"}
        <Text content="Objectives" style={TextStyle.SECTION_HEADING} />
      {/if}
      <LogThumbnailObjectivesInfo {session} />
    </div>
    {#if variant === "v2"}
      <div
        class="flex gap-2 justify-between text-b4 border-t border-brs1 px-3 py-1 rounded-md"
      >
        <div class="min-w-fit text-fgs1">
          Total:
          {formatSeconds(total)}
        </div>
        <div class="min-w-fit text-aps1">
          F:
          {formatSeconds(session.splits.focus)}
        </div>
        <div class="min-w-fit text-ass1">
          B:
          {formatSeconds(session.splits.brek)}
        </div>
      </div>
    {/if}
  </div>
  <div
    class="absolute right-0 mr-4 rounded-r-md h-full flex flex-col pr-2 justify-center"
  >
    {#if context == "logs" || (isHovering && !$view.isPortrait)}
      <Icon icon="chevron-right" />
    {/if}
  </div>
</HoverableElement>
