<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import type { IBreadcrumbItem } from "@21n/elements/breadcrumbsV2/breadcrumbItem.type";

  import BreadcrumbItem from "@21n/elements/breadcrumbsV2/BreadcrumbItem.svelte";
  import { popover } from "@nucleum/actions/popover.action";
  import BreadcrumbsOverflowPopover from "@21n/elements/breadcrumbsV2/BreadcrumbsOverflowPopover.svelte";
  import { PopoverTriggerMethod } from "@nucleum/actions/popover.type";
  import { cn } from "@21n/utils/ui.utils";
  let {
    items = [],
    isPreventDefault = false,
    limit = 3,
    onClick = undefined
  }: {
    items?: IBreadcrumbItem[];
    isPreventDefault?: boolean;
    limit?: number;
    onClick?:
      | ((
          event: CustomEvent<{
            event: MouseEvent | KeyboardEvent;
            item: IBreadcrumbItem;
          }>
        ) => void)
      | undefined;
  } = $props();
  /**
   * Delegates click event when set to `true` instead of defaulting to resource click handler
   */

  function handleClick(e: MouseEvent | KeyboardEvent, item: IBreadcrumbItem) {
    if (isPreventDefault) {
      onClick?.(new CustomEvent("click", { detail: { event: e, item } }));
      return;
    }
    if (item.path) navigation.gotoPath(item.path);
    else if (item.resourceId) {
      const lastItem = items[items.length - 1];
      const replaceId = lastItem.id ?? lastItem.resourceId;
      navigation.resourceClickHandler(
        e instanceof MouseEvent ? e : undefined,
        item.resourceId,
        {
          replaceId
        }
      );
    }
  }
</script>

{#if items?.length > 0}
  <div class="flex w-full items-center">
    {#if items.length > limit}
      <div class="flex-shrink-0">
        <BreadcrumbItem
          label={items[0].label}
          onClick={(e) => {
            handleClick(e, items[0]);
          }}
        />
      </div>
      <button
        class="flex-shrink-0"
        use:popover={{
          content: BreadcrumbsOverflowPopover,
          triggerMethod: [PopoverTriggerMethod.CLICK],
          id: "breadcrumbs-overflow-popover",
          componentProps: {
            items: items.slice(1, -1),
            replaceId: items[items.length - 1].id
          }
        }}
      >
        <span class="px-2 rounded-md hover:bg-bgs2"> .... </span>
        <span class="px-2 opacity-50">/</span>
      </button>
      <div class="flex-1 min-w-0 overflow-hidden">
        {#each items.slice(-1) as item, index}
          <BreadcrumbItem
            label={item.label}
            isDisabled={item.disabled}
            isLast={index === 0}
            onClick={(e) => {
              handleClick(e, item);
            }}
          />
        {/each}
      </div>
    {:else}
      {#each items as item, index (item)}
        <div
          class={cn("flex-shrink-0", {
            "flex-1 min-w-0": index === items.length - 1
          })}
        >
          <BreadcrumbItem
            label={item.label}
            isDisabled={item.disabled}
            isLast={index === items.length - 1}
            onClick={(e) => {
              handleClick(e, item);
            }}
          />
        </div>
      {/each}
    {/if}
  </div>
{/if}
