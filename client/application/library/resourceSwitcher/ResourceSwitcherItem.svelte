<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { Placement } from "@21n/elements/direction.enum";
  import { Size } from "@21n/elements/size.enum";
  import { properCase } from "@21n/shared-utils/text.utils";
  import type { IResourceSwitchItem } from "@21n/elements/select/select.type";
  import { cn } from "@21n/utils/ui.utils";
  import Icon from "@21n/elements/Icon.svelte";
  import AvatarRenderer from "@21n/elements/avatarPicker/AvatarRenderer.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import { resourceAction } from "@nucleum/datafn/resource.utils";
  import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import { appMenuStore } from "@21n/layout/navigation/app-menu.store";
  import { PopoverTriggerMethod } from "@nucleum/actions/popover.type";
  import { hoverable } from "@nucleum/actions/hover.action";
  import { popover } from "@nucleum/actions/popover.action";
  import ContextMenu from "@21n/elements/contextMenu/ContextMenu.svelte";
  import Badge from "@21n/elements/text/Badge.svelte";
  import view from "@nucleum/stores/view.store";
  import { isHideCreateAction } from "@nucleum/application/library/library.utils";

  let {
    item,
    isActive = false,
    parentBgIndex = 1,
    isShowCount = false,
    count = 0,
    onClick = undefined
  }: {
    item: IResourceSwitchItem;
    isActive?: boolean;
    parentBgIndex?: number;
    isShowCount?: boolean;
    count?: number;
    onClick?: (() => void) | undefined;
  } = $props();
  let isHovering = $state(false);
  let popRef: HTMLButtonElement;
  let resource = $derived(item.value as Resource);
  let isConstrainedWidth = $derived($view.isConstrainedWidth);

  function resolveContextMenu() {
    const isCurrentResourcePinned =
      $appMenuStore[$appStore.product]?.user?.includes(resource);
    if (resource === Resource.space) {
      return [];
    }
    const pinAction = {
      label: isCurrentResourcePinned
        ? "Unpin from App menu"
        : "Pin to App menu",
      value: "pin",
      icon: isCurrentResourcePinned ? "minus-circle" : "pin",
      callback: async () => {
        if (!isCurrentResourcePinned) appMenuStore.addUserMenuItem(resource);
        else appMenuStore.removeUserMenuItem(resource);
        popRef.dispatchEvent(new CustomEvent("hide"));
      }
    };
    const createAction = {
      label: "Create new",
      value: "create",
      icon: "plus",
      callback: async () => {
        requireCommandHost().runAction(
          resourceAction(resource, ResourceActionType.CREATE)
        );
        popRef.dispatchEvent(new CustomEvent("hide"));
      }
    };
    if (isHideCreateAction(resource)) {
      return [
        {
          group: "all",
          items: [pinAction]
        }
      ];
    }
    return [
      {
        group: "all",
        items: [pinAction, createAction]
      }
    ];
  }
</script>

<button
  bind:this={popRef}
  use:hoverable={{
    onHover: (e) => (isHovering = e)
  }}
  use:popover={{
    placement: Placement.BottomCenter,
    content: ContextMenu,
    triggerMethod: [PopoverTriggerMethod.RIGHT_CLICK],
    componentProps: { menuResolver: resolveContextMenu },
    id: "resourceSwitcherContextMenu",
    groupId: "resourceSwitcherContextMenuGroup"
  }}
  class={cn(
    "relative flex-1 flex gap-1 items-center whitespace-nowrap border rounded-md text-b2 transition-all",
    {
      "px-4 py-3": isConstrainedWidth,
      "px-3 py-2": !isConstrainedWidth,
      "border border-aps1 bg-aps3": isActive,
      "opacity-80 cursor-not-allowed": item.isDisabled
    },
    !isActive && {
      "outline-transparent ": true,
      "text-fgs2 bg-bgs1 border-brs2": !isConstrainedWidth,
      "text-fgs1 bg-bgs2 border-brs3": isConstrainedWidth,
      "notouch:hover:bg-bgs3-striped active:bg-bgs3-striped focus:bg-bgs3-striped hover:text-fgs1":
        !item.isDisabled
    }
  )}
  onclick={() => onClick?.()}
>
  <div
    class={cn("flex flex-col items-start", {
      "text-aps1": isActive,
      "gap-2": !isConstrainedWidth,
      "gap-3": isConstrainedWidth
    })}
  >
    {#if item.icon && typeof item.icon === "string"}
      <Icon
        icon={item.icon}
        size={isConstrainedWidth ? Size.lg : Size.md}
        isFilled={isActive}
        class={cn({
          "fill-aps1": isActive,
          "stroke-fgs2":
            (!isConstrainedWidth && !isActive && !isHovering) ||
            item.isDisabled,
          "stroke-fgs1":
            (!isActive && isHovering && !item.isDisabled) || isConstrainedWidth
        })}
      />
    {:else if item.icon && typeof item.icon === "object"}
      <AvatarRenderer avatar={item.icon} size={Size.lg} />
    {/if}
    <span>
      {properCase(item.label ?? item.value.toString())}
    </span>
  </div>
  <!-- {#if isHovering && !item.isHidePinAction}
    <div class={cn("absolute right-0 top-0 p-1", {})}>
      <Icon icon={item.isPinned ? "unpin" : "pin"} size={Size.lg} />
    </div>
  {/if} -->
  {#if isShowCount && count > 0}
    <span class="absolute right-0 top-0 m-3 leading-none">
      <span
        class={cn({
          "text-h4": isConstrainedWidth,
          "text-aps1": isActive,
          "text-fgs3": !isActive
        })}
      >
        {count}
      </span>
      <!-- <Badge
        text={count}
        size={Size.sm}
        parentBgIndex={isHovering ? parentBgIndex : parentBgIndex - 1}
        isAccentColor={isActive}
      /> -->
    </span>
  {/if}
  {#if item.badge}
    <span class="absolute right-0 top-0 m-2">
      <Badge
        text={item.badge}
        size={Size.sm}
        parentBgIndex={isHovering ? parentBgIndex : parentBgIndex - 1}
        isAccentColor={isActive}
      />
    </span>
  {/if}
</button>
