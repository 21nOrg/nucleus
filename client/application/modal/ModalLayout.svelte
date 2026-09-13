<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import type { Snippet } from "svelte";
  import modalEvent from "@nucleum/stores/overlays/modal.store";
  import { confirmationNotification } from "@nucleum/stores/notification.store";
  import { appEvents } from "@nucleum/stores/events/app-events.store";
  import { Size } from "@21n/elements/size.enum";
  import ModalFooter from "@21n/elements/modal/ModalFooter.svelte";
  import ModalHeader from "@21n/elements/modal/ModalHeader.svelte";
  import type { ModalParams } from "@21n/elements/modal/popup.type";
  import { fly } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import context from "@nucleum/stores/context.store";
  import { Embed } from "@nucleum/client/runtime/context.type";
  import { cn } from "@21n/utils/ui.utils";
  import { Action } from "@nucleum/client/config/action.enum";
  import { onMount } from "svelte";
  import { GlobalEvent } from "@nucleum/stores/notifications/event.enum";
  import { resolveModalOnFront } from "@21n/utils/browser.utils";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import Icon from "@21n/elements/Icon.svelte";

  import { popover, tooltip } from "@nucleum/actions/popover.action";
  import { Placement } from "@21n/elements/direction.enum";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import view from "@nucleum/stores/view.store";
  import ButtonTooltip from "@21n/elements/button/ButtonTooltip.svelte";
  import { PopoverTriggerMethod } from "@nucleum/actions/popover.type";
  import ModalContentPadded from "@21n/elements/modal/ModalContentPadded.svelte";
  import { KeyboardKey } from "@21n/elements/keyboard/keyboard.type";

  let {
    path,
    resource = undefined,
    params,
    children = undefined
  }: {
    path: string;
    resource?: string | undefined;
    params: ModalParams;
    children?: Snippet | undefined;
  } = $props();
  const size = $derived(params.layout?.size ?? Size.md);
  let footerRef = $state<any>();
  onMount(() => {
    const appEventSub = appEvents.subscribe((x) => {
      const frontModal = resolveModalOnFront();
      logger.log({
        frontModalId: frontModal?.id,
        path,
        event: x.event
      });
      if (!frontModal || path != frontModal?.id) return;
      if (x.event === GlobalEvent.ESCAPE) {
        handleClose();
      }
    });
    const keydownListener = (event: KeyboardEvent) => {
      if (event.key !== KeyboardKey.ESCAPE) return;
      const frontModal = resolveModalOnFront();
      if (!frontModal || path != frontModal?.id) return;
      event.preventDefault();
      event.stopPropagation();
      handleClose();
    };
    window.addEventListener("keydown", keydownListener);
    return () => {
      window.removeEventListener("keydown", keydownListener);
      appEventSub();
    };
  });

  export function close() {
    footerRef?.close();
  }
  function handleClose(accessMode?: AccessMode) {
    if (params.isDismissable === false) return;
    if (path === Action.CONFIRMATION) confirmationNotification.reset();
    else if (resource)
      navigation.closeResource({
        id: resource,
        accessMode: accessMode
      });
    else modalEvent.hide(path, "ModalLayout.svelte");
  }
</script>

{#if size === Size.full}
  <div
    class="w-full h-full flex justify-center items-center embed-ios:bg-bgs1"
    in:fly={{
      duration: 400,
      delay: 0,
      easing: quintOut,
      x: 0,
      y: 100,
      opacity: 0
    }}
  >
    {#if $context.embed === Embed.HANDSET && !$context.isSheet}
      <div
        class={cn("flex flex-col w-full h-full gap-2", {
          "p-2 otop:pt-12": params.title
        })}
      >
        {#if params.title}
          <ModalHeader
            title={params.title}
            onClose={() => handleClose()}
            isShowClose={true}
          />
        {/if}
        {@render children?.()}
      </div>
    {:else}
      {@render children?.()}
    {/if}
  </div>
{:else}
  <div
    class={cn(
      "relative modal flex flex-col items-center justify-between rounded-md embed-ios:bg-bgs1 cw:w-full cw:h-full",
      {
        "dark:border border-brs3": !$view.isConstrainedWidth,
        "otop:pt-12": !resource || params.title,
        "w-full h-full": !params.layout?.isDynamicSize
      },
      !params.layout?.ignoreSafeArea && {
        "gap-4": size === Size.xs,
        "gap-6": size !== Size.xs,
        "pt-6": !params.title
      }
    )}
    in:fly={{
      duration: 400,
      delay: 0,
      easing: quintOut,
      x: 0,
      y: 10,
      opacity: 0
    }}
  >
    {#if params.title && !$context.isSheet}
      <ModalHeader
        title={params.title}
        onClose={() => handleClose()}
        isShowClose={$context.embed === Embed.HANDSET && size !== Size.xs
          ? true
          : params.layout?.isShowClose}
      />
    {/if}

    <div
      class={cn(
        "flex flex-col gap-4 flex-grow overflow-hidden mo:rounded-none rounded-md cw:w-full",
        {
          "w-full h-full": !params.layout?.isDynamicSize
        }
      )}
    >
      {#if !params.layout?.ignoreSafeArea && !params.layout?.isOveriddenFooter}
        <ModalContentPadded
          isExtraSmall={size === Size.xs}
          isDynamicSize={params.layout?.isDynamicSize}
          {children}
        />
      {:else}
        {@render children?.()}
      {/if}
    </div>

    {#if params.layout?.primaryAction || params.layout?.secondaryAction || params.layout?.isShowClose}
      <ModalFooter
        action={path}
        size={size === Size.xl || size === Size.xxl
          ? Size.lg
          : size === Size.xxs
            ? Size.xs
            : size}
        primaryAction={params.layout?.primaryAction}
        secondaryAction={params.layout?.secondaryAction}
        isDelegateClose={true}
        bind:this={footerRef}
        onClose={() => handleClose()}
        isShowClose={params.layout?.isShowClose}
      />
    {/if}
    {#if params.layout?.isShowCantileverClose}
      <button
        type="button"
        aria-label="Close"
        data-testid="modal-close"
        class="absolute top-2 -right-10 bg-ars1 w-10 h-12 rounded-r-md flex justify-center items-center hover:brightness-110"
        onclick={() => handleClose(AccessMode.POP)}
        use:popover={{
          content: ButtonTooltip,
          triggerMethod: [PopoverTriggerMethod.HOVER],
          placement: Placement.Left,
          offsetInPx: 5,
          isSecondary: true,
          id: `modal-close`,
          componentProps: {
            tooltip: "Close",
            shortcut: Action.CLOSE,
            size: Size.sm
          }
        }}
      >
        <Icon icon="cross" size={Size.lg} class="stroke-abg" />
      </button>
    {/if}
    {#if params.layout?.isShowBackButton}
      <button
        class="absolute top-16 -right-10 bg-bgs4 w-10 h-12 rounded-r-md flex justify-center items-center hover:brightness-110"
        onclick={() => navigation.goBack(resource)}
        use:tooltip={{ text: "Go back", direction: Placement.Left }}
      >
        <Icon icon="back" size={Size.lg} class="stroke-fgs1" />
      </button>
    {/if}
  </div>
{/if}

<style>
  @keyframes slideIn {
    0% {
      transform: translateY(100px);
      opacity: 0;
    }
    100% {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .modal-slide {
    animation: slideIn 0.2s ease-in-out forwards;
  }
  @keyframes flyIn {
    0% {
      transform: translate(0px, 100px);
      opacity: 0;
    }
    100% {
      transform: translate(0px, 0px);
      opacity: 1;
    }
  }

  .modal-disabled {
    animation: flyIn 0.4s cubic-bezier(0.23, 1, 0.32, 1) forwards;
  }
</style>
