<svelte:options runes={true} />

<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { cn } from "@21n/utils/ui.utils";
  import { Size } from "@21n/elements/size.enum";
  import SubAtomLogo from "@21n/branding/SubAtomLogo.svelte";
  import ProfilePicture from "@nucleum/application/settings/account/ProfilePicture.svelte";

  import { tooltip } from "@nucleum/actions/popover.action";
  import { determineIfActiveSubscriber } from "@nucleum/client/runtime/account/plan.utils";
  import { UserDataMode } from "@nucleum/client/runtime/account/account.type";
  import account from "@nucleum/stores/account.store";
  import { Action } from "@nucleum/client/config/action.enum";
  import { uiState } from "@nucleum/stores/uiState/uiState.store";
  import { UIState, UIStateScope } from "@nucleum/stores/uiState/uiState.type";
  import { onMount } from "svelte";
  import context from "@nucleum/stores/context.store";

  import Icon from "@21n/elements/Icon.svelte";
  let {
    action = undefined,
    isRenderProfilePicture = false,
    callback = undefined
  }: {
    action?: string;
    isRenderProfilePicture?: boolean;
    callback?: () => void;
  } = $props();

  let isHideMenuLabels = $state(
    uiState.getState(UIState.hideLeftNavMenuLabels, {
      scope: UIStateScope.DAP
    })
  );

  onMount(() => {
    const unsubscribe = uiState.subscribe((x) => {
      isHideMenuLabels = uiState.getState(UIState.hideLeftNavMenuLabels, {
        scope: UIStateScope.DAP
      });
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  });

  let isSubscriber = $derived(
    $account?.plan && $account?.dataMode === UserDataMode.CLOUD
      ? determineIfActiveSubscriber($account.plan)
      : false
  );
</script>

<button
  data-testid="topnav-account-settings"
  class={cn(
    "group flex items-center h-full w-fit hover:bg-bgs3-striped",
    !action && {
      "px-[0.72rem]": isHideMenuLabels,
      "px-[1.72rem]": !isHideMenuLabels,
      "border-r border-brs3": !$context.experiments?.isEnableRoundedMain
    },
    action && {
      "px-[1.08rem]": isHideMenuLabels,
      "px-[2.08rem]": !isHideMenuLabels,
      "border-r border-brs3": !$context.experiments?.isEnableRoundedMain
    }
  )}
  onclick={() => {
    if (callback) {
      callback();
    } else {
      requireCommandHost().runAction(action ?? Action.SETTINGS);
    }
  }}
>
  {#if isRenderProfilePicture}
    <div class="px-1">
      <div
        class={cn("flex items-center gap-2 rounded-full overflow-hidden", {
          "outline outline-ags1 group-hover:brightness-110": isSubscriber,
          "hover:outline group-hover:outline-brs3": !isSubscriber
        })}
        use:tooltip={{
          text: "Account & settings"
        }}
      >
        <ProfilePicture context="topbar" />
      </div>
    </div>
  {:else if action}
    <div class="flex items-center justify-center">
      <Icon icon={"settings"} />
    </div>
  {:else}
    <div class="opacity-50">
      <SubAtomLogo size={Size.sm} />
    </div>
  {/if}
</button>
