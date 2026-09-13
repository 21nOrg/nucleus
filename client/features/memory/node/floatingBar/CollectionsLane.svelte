<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { Resource } from "@nucleum/datafn/resource.enum";
  import Button from "@21n/elements/button/Button.svelte";
  import Divider from "@21n/elements/Divider.svelte";
  import Icon from "@21n/elements/Icon.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import { toasts } from "@nucleum/stores/notification.store";
  import { ColorStrength } from "@21n/theme/appearance.type";
  import { Orientation, Placement } from "@21n/elements/direction.enum";
  import { Size } from "@21n/elements/size.enum";
  import LinkItems from "@nucleum/features/memory/common/linkbox/LinkItems.svelte";
  import LinkSearch from "@nucleum/features/memory/common/linkbox/LinkSearch.svelte";
  import type { IActiveNodeStore } from "@nucleum/features/memory/node/node.store";
  import {
    resolveNodeContentLabel,
    resolveNodeIcon
  } from "@nucleum/features/memory/node/node.utils";
  import {
    resourceAction,
    resourceInList
  } from "@nucleum/datafn/resource.utils";
  import { popover, tooltip } from "@nucleum/actions/popover.action";
  import { headingNodeTypes } from "@nucleum/features/memory/node/node.type";
  import { NodeType } from "@nucleum/schema/legacy/node-type.enum";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { ResourceError } from "@nucleum/datafn/resource-error";
  import { ResourceErrorCode } from "@nucleum/schema/resource-error.enum";
  import {
    AccessMode,
    ResourceAccessPoint
  } from "@nucleum/datafn/resource.type";
  import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
  import view from "@nucleum/stores/view.store";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";
  import { getContext } from "svelte";
  import {
    PRODUCT_NAV_CONTEXT,
    getProductNavConfig,
    type IProductNavConfig
  } from "@nucleum/client/config/product-nav.config";
  import { Action } from "@nucleum/client/config/action.enum";

  let {
    node,
    isReadOnlyMode = false
  }: {
    node: IActiveNodeStore;
    isReadOnlyMode?: boolean;
  } = $props();
  let popoverRef: any;
  const productNavigation = getContext<IProductNavConfig>(PRODUCT_NAV_CONTEXT);
  let isPreventContentTypeRender = $derived(
    headingNodeTypes.includes($node.contentType)
  );

  async function onUnlink(e: CustomEvent) {
    try {
      await node.unlinkCollection(e.detail);
    } catch (error) {
      logger.error({ at: "CollectionsLane.onUnlink", error });
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
      if ($node.collections?.some(resourceInList(id))) {
        toasts.error("Collection already exists.");
        return;
      }
      const result = await node.linkCollection(id);
      if (!result) {
        toasts.error();
        return;
      }
    } catch (e) {
      logger.error({ at: "CollectionsLane.onSelect", error: e });
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
  {#if !isPreventContentTypeRender}
    <button
      class="flex items-center gap-2 h-full border border-bgs4 hover:border-fgs3 rounded-full px-2 py-0.5 text-b2 whitespace-nowrap bg-bgs2 text-fgs1"
      onclick={() => {
        navigation.closeResource();
        const path = $view.isPortrait
          ? resourceAction(Resource.node, ResourceActionType.BROWSE)
          : Action.LIBRARY;
        navigation.gotoPath(`/${path}`, {
          queryParams: {
            resource: Resource.node,
            type: $node.contentType.toLowerCase(),
            [AppSearchParam.RETURN_TO]:
              productNavigation?.homePathPt ??
              getProductNavConfig($appStore.product).homePathPt
          }
        });
      }}
      use:tooltip={{
        text: `See all ${resolveNodeContentLabel($node.contentType)} nodes`,
        direction:
          $node.contentType === NodeType.NODULAR_MARKDOWN
            ? Placement.Bottom
            : Placement.Top
      }}
    >
      <Icon
        icon={resolveNodeIcon($node.contentType)}
        size={Size.sm}
        class="fill-fgs1"
      />
      {resolveNodeContentLabel($node.contentType)}
    </button>
    <span class="h-full flex items-center justify-center">
      <Divider
        orientation={Orientation.Vertical}
        colorStrength={ColorStrength.Strong}
      />
    </span>
  {/if}

  {#if $node.collections && $node.collections.length > 0}
    <span>
      <LinkItems
        accessPoint={ResourceAccessPoint.SELF}
        links={$node.collections}
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
        id: "collections-lane-popover",
        componentProps: {
          onSelectCallback: onSelect,
          searchQuery: "",
          onHideCallback: () => {
            hidePopover();
          },
          accessPoint: ResourceAccessPoint.NODE,
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
