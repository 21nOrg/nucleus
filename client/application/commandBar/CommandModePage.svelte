<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import type { Snippet } from "svelte";
  import Button from "@21n/elements/button/Button.svelte";
  import Divider from "@21n/elements/Divider.svelte";
  import ComponentResolver from "@21n/layout/paint/ComponentResolver.svelte";
  import account from "@nucleum/stores/account.store";
  import { currentTime } from "@nucleum/stores/app.store";
  import { userPreferences } from "@nucleum/stores/preferences/user-preferences.store";
  import { uiState } from "@nucleum/stores/uiState/uiState.store";
  import view from "@nucleum/stores/view.store";
  import { Action } from "@nucleum/client/config/action.enum";
  import { ColorStrength } from "@21n/theme/appearance.type";
  import { Orientation } from "@21n/elements/direction.enum";
  import { Size } from "@21n/elements/size.enum";
  import { Display } from "@21n/elements/display.enum";
  import { formatDatetime } from "@21n/utils/time.utils";
  import { player } from "@nucleum/stores/overlays/modal.store";
  import ProfilePicture from "@nucleum/application/settings/account/ProfilePicture.svelte";
  import { InteractionMode } from "@21n/elements/keyboard/interaction-mode.type";
  import CommandBar from "@nucleum/application/commandBar/CommandBar.svelte";
  import ShortcutText from "@21n/elements/text/ShortcutText.svelte";
  import Tabs from "@21n/layout/topNav/tabs/Tabs.svelte";
  import { page } from "$app/stores";
  import PagePainterV2 from "@21n/layout/paint/PagePainterV2.svelte";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import { onMount } from "svelte";
  import { tabs } from "@21n/layout/topNav/tabs/tabs.store";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  import { UIStateScope } from "@nucleum/stores/uiState/uiState.type";
  let { children }: { children?: Snippet } = $props();
  let isInFocusMode = false;
  let pinnedItems = $state<IRecordId[]>(tabs.get() ?? []);

  function handleFocusMode(e: CustomEvent<boolean>) {
    if (typeof e.detail === "boolean") {
      isInFocusMode = e.detail;
    }
  }
  onMount(() => {
    const unsubscribe = uiState.subscribe((x) => {
      pinnedItems = tabs.get() ?? [];
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  });
  let isCmdHome = $state(true);
  let activeTab = $derived($page.url.searchParams.get(AccessMode.TAB));
</script>

<div class="flex flex-col w-full h-full">
  <div>
    <Tabs
      {pinnedItems}
      isShowHome={true}
      {activeTab}
      onHome={(value) => {
        isCmdHome = value;
        if (isCmdHome) navigation.toggleSearchParam([AccessMode.TAB]);
      }}
    />
  </div>
  {#if activeTab?.includes("page:")}
    <div class="w-full min-h-0 flex-1">
      <PagePainterV2 cmdPageLaunch={activeTab.split("page:")[1]} />
    </div>
  {:else if isCmdHome}
    <div
      class="flex flex-col dp:flex-row gap-6 w-full flex-1 min-h-0 justify-center items-center p-4 tp:p-8 dp:p-16"
    >
      <div
        class="dp:w-1/2 dp:h-full flex flex-col gap-6 dp:justify-center items-start"
      >
        <ProfilePicture context="cmd-page" />
        <button
          class="flex flex-col gap-1 items-start"
          onclick={() => {
            requireCommandHost().runAction(Action.SETTINGS);
          }}
        >
          <div class="text-xl text-fgs2 userdata">
            Hi {$account.userInfo?.nickName}!
          </div>
          <div class="text-fgs3">
            {formatDatetime($userPreferences, $currentTime)}
          </div>
        </button>
        {#if $player.isMiniOn}
          <Divider />
          <ComponentResolver path={$player.action + Action.CMD} />
        {/if}
      </div>
      <!-- {#if $view.display === Display.DP}
        <Divider
          orientation={Orientation.Vertical}
          colorStrength={ColorStrength.Strong}
        />
      {/if} -->
      <div
        class="h-96 w-[40rem] dp:h-[40rem] dp:w-1/2 flex justify-center items-center"
      >
        <div class="h-full w-full dp:h-2/3 dp:w-full flex items-center">
          <CommandBar isFullPageContext={true} />
        </div>
      </div>
    </div>
    <footer
      class="w-full flex flex-col gap-2 justify-center items-center h-1/6 text-fgs2 text-b2"
    >
      <div class="flex flex-col items-center gap-4">
        <span class="flex flex-row text-fgs3 gap-1">
          Press
          <ShortcutText
            shortcut={Action.SEARCH}
            parentBgIndex={2}
            isAlwaysShown={true}
          />
          to search
        </span>
        <Button
          label="Exit Command Mode"
          size={Size.sm}
          onclick={() => {
            uiState.setState(
              Action.MODE_OF_INTERACTION,
              InteractionMode.DEFAULT,
              {
                scope: UIStateScope.PRODUCT
              }
            );
          }}
        />
      </div>
    </footer>
  {:else}
    {@render children?.()}
  {/if}
</div>
