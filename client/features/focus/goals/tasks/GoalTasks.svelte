<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { page } from "$app/stores";
  import InlineInfoBanner from "@21n/elements/text/InlineInfoBanner.svelte";
  import {
    AccessMode,
    ResourceAccessPoint
  } from "@nucleum/datafn/resource.type";
  import TaskLibrary from "@nucleum/features/focus/tasks/TaskLibrary.svelte";
  import Task from "@nucleum/features/focus/tasks/Task.svelte";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";

  let {
    id,
    isActiveResource = true
  }: {
    id: IRecordId;
    isActiveResource?: boolean;
  } = $props();

  const taskParam = $derived(
    navigation.resolveRecordSpecificSearchParam(id, "task")
  );
  const selectedTaskId = $derived(
    $page.url.searchParams.get(taskParam) as IRecordId | null
  );
</script>

{#if !isActiveResource}
  <div class="flex w-full pt-2 pb-4 justify-center">
    <InlineInfoBanner
      content="You can't add tasks to this objective when it is archived/deleted/inactive."
      icon="warning"
    />
  </div>
{/if}
<div class="flex h-full w-full gap-3">
  <TaskLibrary
    objectiveId={id}
    isPreventAddNew={!isActiveResource}
    accessPoint={ResourceAccessPoint.OBJECTIVE}
  />
  {#if selectedTaskId}
    <div class="shrink-0 min-w-96 w-96 bg-bgs2 border-l border-brs2">
      <Task
        id={selectedTaskId}
        accessPoint={ResourceAccessPoint.OBJECTIVE}
        accessPointId={id}
        accessMode={AccessMode.INLINE}
      />
    </div>
  {/if}
</div>
