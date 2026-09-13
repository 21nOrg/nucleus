<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { Resource } from "@nucleum/datafn/resource.enum";
  import Button from "@21n/elements/button/Button.svelte";
  import Divider from "@21n/elements/Divider.svelte";
  import Icon from "@21n/elements/Icon.svelte";

  import { toasts } from "@nucleum/stores/notification.store";
  import { ColorStrength } from "@21n/theme/appearance.type";
  import { Orientation, Placement } from "@21n/elements/direction.enum";
  import { Size } from "@21n/elements/size.enum";
  import LinkItems from "@nucleum/features/memory/common/linkbox/LinkItems.svelte";
  import LinkSearch from "@nucleum/features/memory/common/linkbox/LinkSearch.svelte";
  import { resourceInList } from "@nucleum/datafn/resource.utils";
  import { popover, tooltip } from "@nucleum/actions/popover.action";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { ResourceError } from "@nucleum/datafn/resource-error";
  import { ResourceErrorCode } from "@nucleum/schema/resource-error.enum";
  import type { IActiveObjectiveStore } from "@nucleum/features/focus/goals/goal.store";
  import { resolveObjectiveTypeIcon } from "@nucleum/features/focus/goals/goal.utils";
  import { enumToString } from "@21n/shared-utils/text.utils";
  import {
    AccessMode,
    ResourceAccessPoint
  } from "@nucleum/datafn/resource.type";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";

  let {
    objective,
    isReadOnlyMode = false
  }: {
    objective: IActiveObjectiveStore;
    isReadOnlyMode?: boolean;
  } = $props();

  let popoverRef = $state<any>(undefined);

  async function onUnlink(e: CustomEvent) {
    try {
      await objective.unlinkCollection(e.detail);
    } catch (error) {
      logger.error(error);
      toasts.error();
      throw error;
    }
  }

  async function onSelect(item: any) {
    try {
      hidePopover();
      const id = item.id;
      if (!id) {
        toasts.error();
        return;
      }
      if ($objective.collections?.some(resourceInList(id))) {
        toasts.error("Collection already exists.");
        return;
      }
      const result = await objective.linkCollection(id);
      if (!result) {
        toasts.error();
        return;
      }
    } catch (e) {
      logger.error(e);
      if (e instanceof ResourceError) {
        if (e.code === ResourceErrorCode.ALREADY_EXISTS) {
          toasts.error("Collection already exists.");
        } else {
          toasts.error();
        }
      } else {
        toasts.error();
      }
    }
  }

  function onClick(e: CustomEvent) {
    if (navigation.determineClickAccessMode(e.detail.event)) {
      navigation.resourceClickHandler(e.detail.event, e.detail.item, {
        searchParams: {
          [AppSearchParam.RESOURCE]: Resource.collection,
          [AppSearchParam.TYPE]: "all"
        }
      });
      return;
    }
    const queryParams = {
      [AppSearchParam.RESOURCE]: Resource.collection,
      [AppSearchParam.TYPE]: "all",
      [AccessMode.POP]: e.detail.item.toString(),
      [`${AccessMode.POP}At`]: new Date().getTime()
    };
    navigation.closeResource({ accessMode: AccessMode.POP });
    setTimeout(() => {
      navigation.gotoPath("/library", { queryParams });
    }, 0);
  }

  function hidePopover() {
    popoverRef?.dispatchEvent(new CustomEvent("hide"));
  }
</script>

<div
  class="flex gap-2 items-center h-full w-full overflow-x-auto mo:pr-4"
  data-testid="collections-lane"
>
  <button
    class="flex items-center gap-2 h-full border border-bgs4 hover:border-fgs3 rounded-full px-2 py-0.5 text-b2 whitespace-nowrap bg-bgs2 text-fgs1"
    onclick={() => {
      navigation.closeResource();
      navigation.gotoPath("/library", {
        queryParams: {
          resource: Resource.objective,
          type: $objective.type?.toLowerCase()
        }
      });
    }}
    use:tooltip={{
      text: `See all **${enumToString($objective.type)}** objectives`,
      direction: Placement.Bottom
    }}
  >
    <Icon
      icon={resolveObjectiveTypeIcon($objective.type)}
      size={Size.sm}
      class="fill-fgs1"
    />
    {enumToString($objective.type)}
  </button>
  <span class="h-full flex items-center justify-center">
    <Divider
      orientation={Orientation.Vertical}
      colorStrength={ColorStrength.Strong}
    />
  </span>

  {#if $objective.collections && $objective.collections.length > 0}
    <span>
      <LinkItems
        links={$objective.collections}
        {isReadOnlyMode}
        {onUnlink}
        {onClick}
      />
    </span>
  {/if}
  {#if !isReadOnlyMode}
    <div
      bind:this={popoverRef}
      use:popover={{
        content: LinkSearch,
        isRenderAsModalForCW: true,
        cwModalPosition: Placement.Top,
        id: "objective-collections-row-popover",
        componentProps: {
          onSelectCallback: onSelect,
          searchQuery: "",
          onHideCallback: () => {
            hidePopover();
          },
          accessPoint: ResourceAccessPoint.OBJECTIVE,
          isCollectionsLane: true
        }
      }}
    >
      <Button
        icon="plus"
        size={Size.sm}
        tooltip="Add to a collection"
        ariaLabel="Add to a collection"
        testId="collections-lane-add"
      />
    </div>
  {/if}
</div>
