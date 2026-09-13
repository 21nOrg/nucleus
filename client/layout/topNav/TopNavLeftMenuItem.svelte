<svelte:options runes={true} />

<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { hoverable } from "@nucleum/actions/hover.action";
  import { popover } from "@nucleum/actions/popover.action";
  import ButtonTooltip from "@21n/elements/button/ButtonTooltip.svelte";
  import Icon from "@21n/elements/Icon.svelte";
  import { Placement } from "@21n/elements/direction.enum";
  import { PopoverTriggerMethod } from "@nucleum/actions/popover.type";
  import { cn } from "@21n/utils/ui.utils";
  import { Size } from "@21n/elements/size.enum";
  import { Action } from "@nucleum/client/config/action.enum";
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import type { IAction } from "@nucleum/client/config/action.type";

  import { AccessMode } from "@nucleum/datafn/resource.type";
  import { keyboardShortcuts } from "@nucleum/stores/keyboard/shortcuts.store";
  import context from "@nucleum/stores/context.store";

  let {
    action,
    isLastItem = false,
    isFirstItem = false,
    label = undefined,
    icon = undefined,
    tooltip = undefined,
    ariaLabel = undefined,
    isPreventDefault = false,
    onClick
  }: {
    action: Action | string;
    isLastItem?: boolean;
    isFirstItem?: boolean;
    label?: string;
    icon?: string;
    tooltip?: string;
    ariaLabel?: string;
    isPreventDefault?: boolean;
    onClick?: (event: MouseEvent) => void;
  } = $props();
  let isHovered = $state(false);
  let data = $state<IAction | null>(null);
  let currentSearchParams = $state(new URLSearchParams(window.location.search));

  let isActive = $derived(
    action === currentSearchParams.get(AccessMode.RIGHT) ||
      action === currentSearchParams.get(AccessMode.MAIN)
  );

  onMount(() => {
    data = requireCommandHost().resolveAction(action);
    const unsubscribe = page.subscribe((p) => {
      currentSearchParams = p?.url?.searchParams ?? new URLSearchParams();
    });

    return () => unsubscribe?.();
  });

  function handleClick(event: MouseEvent) {
    if (isPreventDefault) {
      onClick?.(event);
      return;
    }
    requireCommandHost().runAction(action);
  }
</script>

{#if data}
  {@const hasTooltip = data.label || tooltip || label}
  {@const accessibleLabel = ariaLabel ?? tooltip ?? label ?? data.label}
  {@const shortcut = keyboardShortcuts.resolveShortcutForAction(action)}
  <button
    aria-label={accessibleLabel}
    class={cn(
      "flex items-center justify-center gap-1 h-full px-3.5 transition-colors",
      {
        "hover:border-brs3 hover:bg-bgs3-striped hover:text-fgs3 text-fgs2":
          !isActive,
        "bg-aps3 text-aps1 border-aps2": isActive,
        "border-l": isLastItem && !$context.experiments?.isEnableRoundedMain,
        "border-x": !isLastItem && !isFirstItem,
        "border-r": isFirstItem && !$context.experiments?.isEnableRoundedMain
      },
      !isActive && {
        "border-brs3": action === Action.RHOMBUS || action === Action.NAVIGATOR,
        "border-transparent":
          action !== Action.RHOMBUS && action !== Action.NAVIGATOR
      }
    )}
    use:hoverable={{
      onHover: (val) => {
        queueMicrotask(() => {
          isHovered = val;
        });
      }
    }}
    use:popover={{
      content: hasTooltip ? ButtonTooltip : "",
      triggerMethod: hasTooltip ? [PopoverTriggerMethod.HOVER] : [],
      placement: Placement.BottomCenter,
      offsetInPx: 5,
      isSecondary: true,
      id: `topnav-menu-tooltip-popover-${data.icon || "default"}`,
      componentProps: hasTooltip
        ? {
            tooltip: tooltip ?? label ?? data.label,
            shortcut,
            parentBgIndex: 2,
            size: Size.sm
          }
        : {}
    }}
    onclick={handleClick}
  >
    <Icon
      icon={icon ?? data.icon}
      isFilled={isHovered}
      class={cn({ "text-fgs3": isHovered && !isActive, "text-aps1": isActive })}
      size={label ? Size.sm : Size.md}
    />
    {#if label}
      <span class="text-b3"> {label} </span>
    {/if}
  </button>
{/if}
