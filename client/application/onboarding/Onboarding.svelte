<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import SubAtomLogo from "@21n/branding/SubAtomLogo.svelte";
  import ColorSchemeSelector from "@nucleum/application/settings/appearance/ColorSchemeSelector.svelte";
  import Button from "@21n/elements/button/Button.svelte";
  import YoutubeVideoPreview from "@nucleum/features/memory/node/content/web/YoutubeVideoPreview.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import appearance from "@nucleum/stores/appearance.store";
  import view from "@nucleum/stores/view.store";
  import { Theme } from "@21n/theme/appearance.type";
  import { ButtonVariant } from "@21n/elements/button/button.type";
  import { Size } from "@21n/elements/size.enum";
  import { cn } from "@21n/utils/ui.utils";
  import type { IOnboardingConfig } from "@nucleum/application/onboarding/onboarding.type";

  let {
    config
  }: {
    config: IOnboardingConfig;
  } = $props();
  const onboardingVideoUrl = $derived(
    $appStore?.appData?.urls?.onboardingVideo
  );
  const docsUrl = $derived(
    $appStore.appData?.urls?.docs ?? $appStore.appData?.urls?.guides
  );
  const isShowVideo = $derived(
    !$view.isConstrainedWidth && Boolean(onboardingVideoUrl)
  );

  function saveColorScheme(e: CustomEvent<string>) {
    appearance.setColorScheme(e.detail);
    appearance.modifySyncWithSystem($appearance.isSyncWithSystem);
  }
</script>

<div class="flex w-full h-full justify-center items-center mo:p-4 p-8">
  <div
    class="flex cw:flex-col w-full justify-center items-center gap-4 h-full max-h-full overflow-auto"
  >
    <main
      class={cn("flex flex-col h-full items-center cw:w-full", {
        "w-1/2": isShowVideo
      })}
    >
      <div class="flex flex-col cw:items-center justify-around h-full">
        <div class="flex flex-col cw:items-center gap-2">
          <div class="-ml-4">
            <SubAtomLogo />
          </div>
          <div class="text-fgs1 cw:text-h3 text-3xl font-medium">
            {config.headline}
          </div>
          <span class="text-fgs3 text-b2">
            {config.subline}
          </span>
        </div>
        <div class="cw:w-full cw:flex cw:justify-center">
          <ColorSchemeSelector
            label="Pick your color scheme"
            size={Size.sm}
            theme={$appearance?.colorScheme?.isDark ? Theme.DARK : Theme.LIGHT}
            selectedSchemeId={$appearance?.colorScheme?.isDark
              ? $appearance.darkColorSchemeId
              : $appearance.lightColorSchemeId}
            onSelect={saveColorScheme}
          />
        </div>
        <div class="flex cw:flex-col w-full cw:justify-center gap-4">
          <Button
            label="Get started"
            icon="proceed"
            type={ButtonVariant.PRIMARY}
            onclick={() => navigation.gotoPath("/")}
          />
          <Button
            label="Read the docs"
            icon="book-open"
            onclick={() => {
              if (docsUrl) navigation.openLink(docsUrl);
            }}
          />
        </div>
      </div>
    </main>
    {#if isShowVideo}
      <aside class="cw:w-full w-1/2">
        <div
          class="cw:w-full w-[40rem] max-w-full h-96 mx-auto rounded-lg overflow-hidden"
        >
          <YoutubeVideoPreview url={onboardingVideoUrl ?? ""} />
        </div>
      </aside>
    {/if}
  </div>
</div>
