<svelte:options runes={true} />

<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { appStore } from "@nucleum/stores/app.store";
  import view from "@nucleum/stores/view.store";
  import LeftNavExpandable from "@21n/layout/leftPanel/LeftNavExpandable.svelte";
  import LeftNavFixed from "@21n/layout/leftPanel/LeftNavFixed.svelte";
  import PortraitBottomNav from "@21n/layout/leftPanel/PortraitBottomNav.svelte";
  import ProfileLeftPanelSection from "@nucleum/application/settings/account/ProfileLeftPanelSection.svelte";
  import Button from "@21n/elements/button/Button.svelte";
  import Icon from "@21n/elements/Icon.svelte";
  import ShortcutText from "@21n/elements/text/ShortcutText.svelte";
  import { Action } from "@nucleum/client/config/action.enum";
  import { Size } from "@21n/elements/size.enum";
  import { resolveProductConfig } from "@nucleum/products/product.config";
  let {
    variant = "expandable",
    isHidePanel = false
  }: {
    variant?: "fixed" | "expandable";
    isHidePanel?: boolean;
  } = $props();
  let isRounded = false;
  const productConfig = resolveProductConfig();
</script>

{#if !$appStore.isMenuHidden}
  {#if $view.isPortrait && productConfig.appMenuPt.length > 0}
    <PortraitBottomNav />
  {:else if !$view.isPortrait && productConfig.appMenu.length > 0}
    {#if variant === "expandable"}
      <LeftNavExpandable {isRounded}>
        {#snippet header()}
          <div class="flex flex-col w-full justify-center items-center gap-4">
            <ProfileLeftPanelSection />
            <div class="px-3 w-full mt-4">
              <button
                class="h-10 w-full flex justify-between items-center px-2 border border-brs3 rounded-md hover:bg-bgs3 text-b2 text-fgs2 font-light"
                onclick={() => requireCommandHost().runAction(Action.SEARCH)}
              >
                <span class="flex gap-2 items-center">
                  <Icon icon="search" size={Size.sm} />
                  <span> Search </span>
                </span>
                <ShortcutText
                  shortcut={Action.SEARCH}
                  parentBgIndex={2}
                  isAlwaysShown={true}
                />
              </button>
            </div>
          </div>
        {/snippet}
        {#snippet headerThin()}
          <div class="w-full flex justify-center">
            <Button
              icon="search"
              parentBgIndex={2}
              onclick={() => requireCommandHost().runAction(Action.SEARCH)}
            />
          </div>
        {/snippet}
      </LeftNavExpandable>
    {:else if variant === "fixed"}
      <LeftNavFixed {isRounded}>
        {#snippet panel()}
          <div class="h-full overflow-auto relative">
            {#if !isHidePanel && $appStore.currentComponent?.panel}
              {@const PanelComponent = $appStore.currentComponent.panel}
              <PanelComponent />
            {/if}
          </div>
        {/snippet}
      </LeftNavFixed>
    {/if}
  {/if}
{/if}
