<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { resizeListener } from "@nucleum/actions/resize.action";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import { userPreferences } from "@nucleum/stores/preferences/user-preferences.store";
  import type { ISessionThumb } from "@nucleum/features/focus/logs/log.type";
  import LogThumbnailObjectivesInfo from "@nucleum/features/focus/logs/LogThumbnailGoalsInfo.svelte";

  import { formatTime } from "@21n/utils/time.utils";
  import { cn } from "@21n/utils/ui.utils";
  import FocusEntryGoalsInfoShort from "@nucleum/features/calendar/column/timeline/focusEntry/FocusEntryGoalsInfoShort.svelte";
  import FocusEntryFocusSplitInfo from "@nucleum/features/calendar/column/timeline/focusEntry/FocusEntryFocusSplitInfo.svelte";
  import { Size } from "@21n/elements/size.enum";

  let {
    item,
    height,
    isOverlapping
  }: {
    item: ISessionThumb & {
      splits: {
        focus: number;
        brek: number;
      };
    };
    height: number;
    isOverlapping: boolean;
  } = $props();

  let width = $state(0);
  const isConstrainedHeight = $derived(height > 0 && height < 100);
  const isConstrainedWidth = $derived(width > 0 && width < 200);
</script>

<button
  class="flex flex-col w-full px-1"
  onclick={() => {
    navigation.openResource(item.id, AccessMode.POP);
  }}
  use:resizeListener={(el) => {
    width = el.width;
  }}
>
  <div
    class={cn("flex justify-between flex-wrap gap--2 w-full", {
      "flex-col": isConstrainedWidth
    })}
  >
    <div class="flex gap-2 items-center text-b3 text-fgs3">
      {formatTime($userPreferences, new Date(item.startUnix))}
      -
      {formatTime($userPreferences, new Date(item.endUnix))}
    </div>
    {#if isConstrainedHeight}
      <div class="flex justify-between gap-2 flex-wrap items-center">
        <FocusEntryGoalsInfoShort {item} />
        <FocusEntryFocusSplitInfo splits={item.splits} />
      </div>
    {:else}
      <FocusEntryFocusSplitInfo
        splits={item.splits}
        size={!isConstrainedWidth && !isConstrainedHeight && !isOverlapping
          ? Size.md
          : Size.sm}
      />
    {/if}
  </div>
  {#if !isConstrainedHeight}
    <LogThumbnailObjectivesInfo session={item} />
  {/if}
</button>
