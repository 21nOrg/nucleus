<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { cn } from "@21n/utils/ui.utils";
  import { Size } from "@21n/elements/size.enum";
  import {
    ContextMenuType,
    type IContextMenuItem
  } from "@21n/elements/contextMenu/context-menu.type";
  import ContextMenuItemBase from "@21n/elements/contextMenu/ContextMenuItemBase.svelte";
  import ContextMenuItemWithSecondary from "@21n/elements/contextMenu/ContextMenuItemWithSecondary.svelte";

  import ContextMenuToggleItem from "@21n/elements/contextMenu/ContextMenuToggleItem.svelte";
  let {
    item,
    isToggleGroup = false,
    parentBgIndex = 1,
    size = Size.md,
    onSelect = undefined
  }: {
    item: IContextMenuItem;
    isToggleGroup?: boolean;
    parentBgIndex?: number;
    size?: Size.sm | Size.md | Size.lg;
    onSelect?: ((event: CustomEvent<IContextMenuItem>) => void) | undefined;
  } = $props();
  let contextMenuItemRef = $state<any>();

  function emitSelect() {
    const selectEvent = new CustomEvent<IContextMenuItem>("select", {
      detail: item
    });
    onSelect?.(selectEvent);
  }
</script>

{#if isToggleGroup}
  <ContextMenuToggleItem
    {item}
    {size}
    {parentBgIndex}
    onChange={(e) => {
      if (item.callback) item.callback(e.detail);
      emitSelect();
    }}
  />
{:else if item.secondStepComponent?.component}
  <ContextMenuItemWithSecondary
    {item}
    {size}
    onSelect={(e) => {
      if (item.callback) item.callback(e.detail);
      emitSelect();
    }}
    onAction={(e) => {
      if (item.callback) item.callback(e.detail);
      emitSelect();
    }}
  />
{:else}
  {@const isRedAccent = item.value?.toString()?.toLowerCase() === "delete"}
  <button
    class={cn(
      "contextmenuitem flex items-center gap-2.5 justify-between rounded-md truncate",
      {
        "p-1.5": size === Size.sm,
        "p-2": size === Size.md,
        "px-3 py-2": size === Size.lg,
        "notouch:hover:bg-bgs3-striped active:bg-bgs3-striped": !isRedAccent,
        "notouch:hover:bg-ars3 active:bg-ars3": isRedAccent
      }
    )}
    data-context-menu-item-id={item.value}
    onclick={(e) => {
      if (item.type === ContextMenuType.SWITCH) {
        if (contextMenuItemRef) contextMenuItemRef.toggle();
        return;
      }
      if (item.callback) item.callback();
      else if (item.action) requireCommandHost().runAction(item.action);
      emitSelect();
      e.stopPropagation();
    }}
  >
    <ContextMenuItemBase
      {item}
      bind:this={contextMenuItemRef}
      {isRedAccent}
      onChange={(e) => {
        if (item.callback) item.callback(e.detail);
      }}
    />
  </button>
{/if}
