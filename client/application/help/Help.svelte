<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import Text from "@21n/elements/text/Text.svelte";
  import { Orientation } from "@21n/elements/direction.enum";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import SettingThumbnail from "@nucleum/application/settings/SettingThumbnail.svelte";
  import AppNameWithVersion from "@nucleum/application/settings/about/AppNameWithVersion.svelte";
  import ProductInfoFooter from "@nucleum/application/settings/about/ProductInfoFooter.svelte";
  import ComponentResolver from "@21n/layout/paint/ComponentResolver.svelte";
  import type { IAction } from "@nucleum/client/config/action.type";
  import NavigationHeader from "@21n/elements/NavigationHeader.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import { parseAndFormatDate } from "@21n/utils/time.utils";
  import { Size } from "@21n/elements/size.enum";

  import account from "@nucleum/stores/account.store";
  import { PlanType } from "@nucleum/schema/account/subscription";
  let pageAction: IAction | null = null;
  let updatedDate: string | undefined = resolveUpdatedDate();
  let config = $derived($appStore?.appData?.help);
  async function runAction(slug: string) {
    if (!slug) return;
    const result = await requireCommandHost().runAction(slug, {
      isReturnIfComponent: true
    });
    if (!result) return;
    if (result.modalParams?.layout?.size === Size.xxl) {
      requireCommandHost().runAction(slug);
      return;
    }
    pageAction = result;
  }

  function resolveUpdatedDate() {
    const release = $appStore?.appData?.release;
    if (!release || !$appStore.version) return;
    const updated = release[$appStore.version];
    if (!updated) return;
    return parseAndFormatDate(new Date(updated));
  }
</script>

{#if config && config?.length > 0}
  <div class="flex flex-col gap-6 w-full h-full p-8">
    {#if pageAction}
      <div class="flex flex-col gap-1 h-full">
        <NavigationHeader
          label={pageAction.label ?? ""}
          backCallback={() => {
            pageAction = null;
          }}
        />
        <ComponentResolver
          action={pageAction}
          params={pageAction?.componentParams ??
            pageAction.modalParams?.componentParams}
        />
      </div>
    {:else}
      <div class="flex w-full justify-between">
        <Text content="Help center" style={TextStyle.PAGE_HEADING} />
        <span class="flex flex-col items-end text-b3 text-fgs3">
          <AppNameWithVersion />
          <div>
            {updatedDate ? "Updated: " + updatedDate : ""}
          </div>
        </span>
      </div>
      <div class="flex flex-col gap-12 w-full flex-grow overflow-auto py-6">
        {#each config as section, sectionIndex}
          {#if !section.isInactive}
            <div class="flex flex-col gap-2 items-start">
              {#if section.section != "main"}
                <!-- <Text content={section.section} style={TextStyle.PANEL_HEADING} /> -->
                <div class="text-fgs3 text-b2 font-medium">
                  {section.section}
                </div>
              {/if}
              <div class="flex flex-wrap gap-3">
                {#if sectionIndex === 0 && $account.plan?.plan === PlanType.NUCLEUS}
                  <SettingThumbnail
                    orientation={Orientation.Vertical}
                    action={"chat"}
                    width="w-40"
                    onclick={() => {
                      runAction("chat");
                    }}
                  />
                {/if}
                {#if section.children}
                  {#each section.children as item}
                    <SettingThumbnail
                      orientation={Orientation.Vertical}
                      action={item}
                      width="w-40"
                      onclick={() => {
                        runAction(item);
                      }}
                    />
                  {/each}
                {/if}
              </div>
            </div>
          {/if}
        {/each}
      </div>
      <ProductInfoFooter isShowSystemStatus={true} isHideAppVersion={true} />
    {/if}
  </div>
{/if}
