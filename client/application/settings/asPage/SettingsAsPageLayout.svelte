<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import type { Snippet } from "svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";
  import { Orientation } from "@21n/elements/direction.enum";
  import SettingsList from "@nucleum/application/settings/asPage/SettingsList.svelte";
  import Text from "@21n/elements/text/Text.svelte";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import ProfileCpSection from "@nucleum/application/settings/account/ProfileCPSection.svelte";
  import { page } from "$app/stores";
  import { retrieveCurrentColors } from "@21n/utils/theme.utils";
  import Panel from "@21n/layout/paint/Panel.svelte";
  import view from "@nucleum/stores/view.store";
  import appearance from "@nucleum/stores/appearance.store";
  import NavigationHeader from "@21n/elements/NavigationHeader.svelte";
  import SettingsFooter from "@nucleum/application/settings/SettingsFooter.svelte";
  import { resolveProductConfig } from "@nucleum/products/product.config";
  import OfflineStatusMessage from "@21n/elements/feedback/OfflineStatusMessage.svelte";
  let {
    isShowBackButton = false,
    children = undefined,
    right = undefined
  }: {
    isShowBackButton?: boolean;
    children?: Snippet | undefined;
    right?: Snippet | undefined;
  } = $props();
  const isCpHome = $derived($page.url.searchParams.get("setting") === null);
  let color = retrieveCurrentColors($appearance)?.aps1;
  const cpConfiguration = resolveProductConfig().settings;
  void color;
</script>

{#if $view.isPortrait && !isCpHome}
  <div class="flex flex-col h-full w-full gap-2 px-4 py-2 otop:pt-12">
    <NavigationHeader
      label={$appStore.currentComponent?.label ?? ""}
      backCallback={() => {
        navigation.toggleSearchParam([AppSearchParam.SETTING]);
      }}
    />
    <div class="flex flex-col flex-grow">
      {@render children?.()}
    </div>
  </div>
{:else if isCpHome || !$view.isPortrait}
  <div class="flex w-full h-full bg-bgs2">
    <Panel
      title="Settings"
      {isShowBackButton}
      parentBgIndex={2}
      onBack={() => {
        navigation.toggleSearchParam([AppSearchParam.SETTING]);
      }}
    >
      {#snippet nonPadded()}
        <div
          class="flex flex-col gap-8 grow overflow-auto portrait:pb-40 pb-20"
        >
          <div class="pt-4">
            <ProfileCpSection
              onclick={() =>
                navigation.toggleSearchParam({
                  [AppSearchParam.SETTING]: "account"
                })}
              parentBackgroundIndex={0}
            />
          </div>
          {#if cpConfiguration}
            {#each cpConfiguration as item}
              <SettingsList
                sectionName={item.isHideTitle ? "" : item.section}
                items={item.children}
                orientation={item.orientation
                  ? item.orientation
                  : Orientation.Horizontal}
              />
            {/each}
          {/if}
          <SettingsFooter />
        </div>
      {/snippet}
      {#snippet topRightActions()}
        <OfflineStatusMessage />
      {/snippet}
      {#snippet right()}
        {#if right}
          {@render right?.()}
        {:else}
          <div class="p-4 flex flex-col gap-4 w-full h-full items-start">
            {#if !isCpHome}
              <Text
                style={TextStyle.PANEL_HEADING}
                content={$view.currentComponent?.label ?? ""}
              />
            {/if}
            <div class="w-full flex-grow">
              {@render children?.()}
            </div>
          </div>
        {/if}
      {/snippet}
    </Panel>
  </div>
{/if}
