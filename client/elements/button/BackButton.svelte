<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import type { Snippet } from "svelte";
  import type { MouseEventHandler } from "svelte/elements";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import { Size } from "@21n/elements/size.enum";
  import { bg, cn } from "@21n/utils/ui.utils";
  import Icon from "@21n/elements/Icon.svelte";
  import view from "@nucleum/stores/view.store";

  import modalEvent from "@nucleum/stores/overlays/modal.store";
  import { haptic } from "@nucleum/client/runtime/embed/embed.utils";

  let {
    text = undefined,
    parentBgIndex = 1,
    isEnabled = true,
    path = undefined,
    accessMode = AccessMode.FULL,
    isPreventDefault = false,
    class: classList = "",
    children = undefined,
    onclick = undefined,
    onback = undefined
  }: {
    text?: string | undefined;
    parentBgIndex?: number;
    isEnabled?: boolean;
    path?: string | undefined;
    accessMode?: AccessMode;
    isPreventDefault?: boolean;
    class?: string;
    children?: Snippet | undefined;
    onclick?: MouseEventHandler<HTMLButtonElement> | undefined;
    onback?: (() => void) | undefined;
  } = $props();
  const hasDefaultContent = $derived(!!children);
  const classes = $derived(
    cn(
      "flex items-center rounded-md",
      hasDefaultContent
        ? "gap-2 px-1"
        : "gap-0 p-1 rounded-r-md rounded-l-full active:bg-bgs2 notouch:hover:bg-bgs2",
      classList,
      {
        "cursor-pointer": isEnabled,
        "cursor-default": !isEnabled,
        [`active:${bg(parentBgIndex)}`]: isEnabled && hasDefaultContent
      }
    )
  );

  function onBack(event: MouseEvent) {
    if (!isEnabled) return;
    haptic();
    const buttonEvent = event as MouseEvent & {
      currentTarget: EventTarget & HTMLButtonElement;
    };
    if (isPreventDefault) {
      onclick?.(buttonEvent);
      onback?.();
      return;
    }
    if ($view.isConstrainedWidth && !path) {
      navigation.goBack();
    } else {
      navigation.closeResource({ accessMode });
    }
    if (path) modalEvent.hide(path, "BackButton.svelte");
    onclick?.(buttonEvent);
  }
</script>

{#if hasDefaultContent && !isEnabled}
  <div class={classes}>
    {@render children?.()}
  </div>
{:else}
  <button
    class={classes}
    type="button"
    tabindex={isEnabled ? 0 : -1}
    aria-disabled={!isEnabled}
    disabled={!isEnabled}
    aria-label={hasDefaultContent ? undefined : (text ?? "Back")}
    onclick={onBack}
  >
    {#if hasDefaultContent}
      {#if isEnabled}
        <Icon icon="chevron-left" size={Size.lg} />
      {/if}
      {@render children?.()}
    {:else}
      <Icon icon="chevron-left" size={Size.sm} />
      <div class="pr-1 text-fgs1">{text ?? "Back"}</div>
    {/if}
  </button>
{/if}
