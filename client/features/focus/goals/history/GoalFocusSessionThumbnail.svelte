<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import type {
    ISessionLogThumb,
    ISessionThumb
  } from "@nucleum/features/focus/logs/log.type";

  import { formatSeconds } from "@21n/utils/time.utils";
  import { cn } from "@21n/utils/ui.utils";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";

  let {
    objectiveId,
    session,
    logs = []
  }: {
    objectiveId: IRecordId;
    session: ISessionThumb;
    logs?: ISessionLogThumb[];
  } = $props();

  function formatTime(date: Date) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  }
</script>

<button
  class="relative flex items-start pl-6"
  onclick={(e) => {
    navigation.resourceClickHandler(e, session.id, {
      origin: objectiveId
    });
  }}
>
  <div class="absolute left-0 top-[10px] w-6 h-[2px] bg-bgs4" />

  <div
    class="flex-1 flex flex-col items-start gap-3 p-4 rounded bg-bgs2 hover:bg-bgs3 transition-colors h-fit justify-between"
  >
    <div class="text-b2 font-medium">
      {formatTime(new Date(session.startUnix))} - {formatTime(
        new Date(session.endUnix)
      )}
    </div>
    <div class="flex flex-col gap-6 w-full">
      {#each logs as log}
        <div class="flex items-center justify-between w-full">
          <div class="flex flex-col gap-2">
            <div class="flex h-1 w-48">
              {#if log.focus}
                <div
                  class={cn("bg-aps1 rounded-l", {
                    "rounded-r": !log.breakTime
                  })}
                  style="flex: {log.focus}; min-width: 2px;"
                  title="Focus: {formatSeconds(log.focus)}"
                />
              {/if}
              {#if log.breakTime}
                <div
                  class={cn("bg-ass1 rounded-r", {
                    "rounded-l": !log.focus
                  })}
                  style="flex: {log.breakTime}; min-width: 2px;"
                  title="Break: {formatSeconds(log.breakTime)}"
                />
              {/if}
            </div>

            <div class="flex gap-3 text-b3 text-fgs2">
              {#if log.focus}
                <span>Focus: {formatSeconds(log.focus)}</span>
              {/if}
              {#if log.breakTime}
                <span>Break: {formatSeconds(log.breakTime)}</span>
              {/if}
            </div>
          </div>
          {#if log.task}
            <button
              onclick={(e) => {
                const taskId = log.task?.id;
                if (!taskId) return;
                e.stopPropagation();
                navigation.resourceClickHandler(e, taskId);
              }}
              class="text-b2 notouch:hover:underline"
            >
              {log.task.label}
            </button>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</button>
