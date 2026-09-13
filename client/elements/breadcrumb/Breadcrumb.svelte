<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import BreadcrumbItemView from "@21n/elements/breadcrumb/BreadcrumbItemView.svelte";
  import type { IBreadcrumbItem } from "@21n/elements/breadcrumbsV2/breadcrumbItem.type";
  import { textTruncateMapper } from "@21n/utils/utils";
  import view from "@nucleum/stores/view.store";
  import { Display } from "@21n/elements/display.enum";
  import { determineTruncateLength } from "@21n/elements/text/truncation.utils";

  import { Resource } from "@nucleum/datafn/resource.enum";
  import { Size } from "@21n/elements/size.enum";
  let {
    items = [],
    isPreventDefault = false,
    spaceAvailable = Size.md,
    isSubtleContext = false,
    onItemClick = () => {}
  }: {
    items?: IBreadcrumbItem[];
    isPreventDefault?: boolean;
    spaceAvailable?: Size.sm | Size.md | Size.lg;
    isSubtleContext?: boolean;
    onItemClick?: (payload: {
      event: MouseEvent | KeyboardEvent;
      item: IBreadcrumbItem;
    }) => void;
  } = $props();
  const slice = $derived(resolveSlice($view.display));
  const truncateLength = $derived(
    determineTruncateLength($view.display, spaceAvailable)
  );
  const resolvedItems = $derived(
    slice != undefined && slice <= items.length
      ? [
          ...items.slice(0, Math.floor(slice / 2)),
          ...(items.length > slice
            ? [
                {
                  isCollapse: true,
                  label: items
                    .slice(Math.floor(slice / 2), -Math.ceil(slice / 2))
                    .map((x) =>
                      textTruncateMapper(x.label, truncateLength + 10)
                    )
                    .join(" / ")
                }
              ]
            : []),
          ...items.slice(-Math.ceil(slice / 2))
        ]
      : items
  );

  function resolveSlice(display: Display) {
    if (display === Display.MO || display === Display.CW) {
      return 2;
    } else if (display === Display.TP || display === Display.DP) {
      return 3;
    } else if (display === Display.TK) {
      return 4;
    } else {
      return 2;
    }
  }
  function onClick(e: MouseEvent | KeyboardEvent, item: IBreadcrumbItem) {
    if (isPreventDefault) {
      onItemClick({ event: e, item });
      return;
    }
    if (item.path) navigation.gotoPath(item.path);
    else if (item.resourceId)
      navigation.gotoResource(
        item.resourceId.split(":")[0] as Resource,
        item.resourceId
      );
  }
</script>

{#if resolvedItems?.length > 0}
  <div class="flex remove-scrollbar rounded-md">
    {#each resolvedItems as item, index (item)}
      <BreadcrumbItemView
        {truncateLength}
        {isSubtleContext}
        {...item}
        isLast={index === resolvedItems.length - 1}
        onActivate={(e) => {
          onClick(e, item);
        }}
      />
    {/each}
  </div>
{/if}
