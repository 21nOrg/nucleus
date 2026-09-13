<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { Resource } from "@nucleum/datafn/resource.enum";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import {
    determineResourceType,
    resourceInList
  } from "@nucleum/datafn/resource.utils";
  import Button from "@21n/elements/button/Button.svelte";
  import Icon from "@21n/elements/Icon.svelte";
  import { isInEditMode } from "@nucleum/stores/app.store";
  import context from "@nucleum/stores/context.store";
  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
  import { Size } from "@21n/elements/size.enum";
  import { formatDateRelativeToToday } from "@21n/utils/time.utils";
  import {
    activeSession,
    currentFocusItem,
    focusItemsStore
  } from "@nucleum/features/focus/session.store";

  let {
    isHovering = false,
    item
  }: {
    isHovering?: boolean;
    item: any;
  } = $props();
  let resourceType = $derived(determineResourceType(item.id));

  let isAdded = $derived($focusItemsStore.items.some(resourceInList(item.id)));

  let isInprogress = $derived(
    activeSession.isCurrentFocusItem(item.id, $currentFocusItem)
  );

  async function onAdd(e: any) {
    e.stopPropagation();
    if (resourceType === Resource.task) {
      await focusItemsStore.addTask(item.id, item.objectiveId);
    } else if (resourceType === Resource.objective) {
      await focusItemsStore.addObjective(item.id);
    }
  }

  async function onStartFocusing(e: any) {
    e.stopPropagation();
    if (resourceType === Resource.task) {
      await activeSession.focusTask(item.id, item.objectiveId);
    } else if (resourceType === Resource.objective) {
      await activeSession.focusObjective(item.id);
    }
    isInEditMode.toggle(false);
  }
</script>

{#if !isInprogress}
  <div class="flex items-center gap-2 px-2 absolute inset-y-0 right-0 bg-bgs2">
    {#if isHovering || $context.isTouchDevice}
      {#if resourceType === Resource.task && !$context.isTouchDevice}
        <Button
          icon="pop"
          tooltip="Open task"
          size={Size.sm}
          style={ButtonStyle.OUTLINED}
          parentBgIndex={2}
          onclick={() => {
            navigation.openResource(item.id, AccessMode.POP);
          }}
        />
      {/if}
      {#if isAdded}
        <span class="text-b3 text-fgs3"> Added </span>
      {:else}
        <Button
          icon="circle"
          tooltip="Start focusing"
          style={ButtonStyle.OUTLINED}
          size={Size.sm}
          onclick={onStartFocusing}
        />
        <Button
          icon="plus"
          tooltip="Add to focus items"
          type={ButtonVariant.PRIMARY}
          style={ButtonStyle.OUTLINED}
          size={Size.sm}
          ariaLabel={`Add ${item.label} to focus items`}
          testId={`focus-item-picker-add:${item.id}`}
          onclick={onAdd}
        />
      {/if}
    {:else}
      {@const startUnix = $focusItemsStore.recents?.find(
        resourceInList(item.id)
      )?.startUnix}
      <span class="text-b3 text-fgs3 userdata">
        {#if isAdded}
          <div class="flex gap-1 items-center">
            <Icon icon="check-circle" isFilled={true} size={Size.sm} />
            <span> Added to focus items </span>
          </div>
        {:else if startUnix}
          Focused {formatDateRelativeToToday(startUnix)?.toLowerCase()}
        {/if}
      </span>
    {/if}
  </div>
{:else if resourceType === Resource.task && !$context.isTouchDevice && isHovering}
  <Button
    icon="pop"
    tooltip="Open task"
    size={Size.sm}
    style={ButtonStyle.OUTLINED}
    parentBgIndex={2}
    onclick={() => {
      navigation.openResource(item.id, AccessMode.POP);
    }}
  />
{/if}
