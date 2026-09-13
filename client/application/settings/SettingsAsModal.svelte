<svelte:options runes={true} />

<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import Text from "@21n/elements/text/Text.svelte";
  import { Orientation } from "@21n/elements/direction.enum";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import SettingThumbnail from "@nucleum/application/settings/SettingThumbnail.svelte";
  import ComponentResolver from "@21n/layout/paint/ComponentResolver.svelte";
  import type { IAction } from "@nucleum/client/config/action.type";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";

  import ProfileCpSection from "@nucleum/application/settings/account/ProfileCPSection.svelte";
  import SettingsFooter from "@nucleum/application/settings/SettingsFooter.svelte";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import { Action } from "@nucleum/client/config/action.enum";
  import { page } from "$app/stores";
  import { resolveProductConfig } from "@nucleum/products/product.config";
  import BackButton from "@21n/elements/button/BackButton.svelte";
  let selected: string = $state("");
  let parentBgIndex: number = 2;
  // resolveAction("theme");
  let pageAction: IAction | null = $state(null);
  const backPath = $derived(
    $page.url.searchParams.get(AppSearchParam.RETURN_TO)
  );
  const config = resolveProductConfig().settings;
  const settingSearchParam = $derived(
    $page.url.searchParams.get(AppSearchParam.SETTING)
  );
  $effect(() => {
    if (settingSearchParam) runAction(settingSearchParam);
  });
  async function runAction(slug: string) {
    if (!slug) {
      pageAction = null;
      return;
    }
    selected = slug;
    const action = requireCommandHost().resolveAction(slug);
    if (action?.component) {
      pageAction = action;
      return;
    }
    pageAction = null;
    requireCommandHost().runAction(slug);
  }
</script>

<div class="flex w-full h-full">
  <div
    data-testid="settings-sidebar"
    class="flex flex-col overflow-auto gap-8 w-72 min-w-72 dp:w-[21rem] dp:min-w-[21rem] shrink-0 bg-bgs2 rounded-l-md py-4 items-start otop:pt-12"
  >
    <div class="pl-4">
      <BackButton
        isEnabled={backPath !== null}
        {parentBgIndex}
        isPreventDefault={true}
        onclick={() => {
          if (backPath) navigation.gotoPath(backPath);
        }}
      >
        <Text
          content="Settings"
          style={backPath ? TextStyle.PANEL_HEADING : TextStyle.PAGE_HEADING}
        />
      </BackButton>
    </div>
    <div class="flex flex-col overflow-auto gap-8 w-full">
      <ProfileCpSection
        context="modal"
        parentBackgroundIndex={2}
        onclick={() => {
          navigation.toggleSearchParam({
            [AppSearchParam.SETTING]: Action.ACCOUNT
          });
        }}
      />
      {#if config}
        <div class=" flex flex-col w-full gap-8">
          {#each config as section}
            <div class="flex flex-col w-full gap-2 items-start">
              {#if !section.isHideTitle}
                <div class="pl-4">
                  <Text
                    content={section.section}
                    style={TextStyle.SECTION_HEADING}
                  />
                </div>
                <!-- <div class="text-fgs3 text-b2 font-medium pl-4">
                {section.section}
              </div> -->
              {/if}
              <div class="flex flex-col w-full">
                {#if section.children}
                  {#each section.children as item}
                    <SettingThumbnail
                      parentBackgroundIndex={2}
                      orientation={Orientation.Horizontal}
                      action={item}
                      isActive={selected === item}
                      width="w-40"
                      onclick={() => {
                        selected = item;
                        const action = requireCommandHost().resolveAction(item);
                        if (action?.component) pageAction = action;
                        navigation.toggleSearchParam({
                          [AppSearchParam.SETTING]: item
                        });
                      }}
                    />
                  {/each}
                {/if}
              </div>
            </div>
          {/each}
          <SettingsFooter {parentBgIndex} />
        </div>
      {/if}
    </div>
  </div>
  <div class="flex flex-col items-start flex-grow h-full p-4 otop:pt-12">
    {#if pageAction}
      <div class="flex justify-start h-10">
        <Text
          content={pageAction.label ?? ""}
          style={TextStyle.PANEL_HEADING}
          isPreventProperCasing={true}
        />
      </div>
      <div class="flex w-full justify-start items-start flex-grow">
        <ComponentResolver action={pageAction} />
      </div>
    {:else}
      <EmptyStatusView subText="Please select a setting to view it here" />
    {/if}
  </div>
</div>
