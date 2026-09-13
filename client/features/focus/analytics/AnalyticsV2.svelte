<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import Button from "@21n/elements/button/Button.svelte";
  import PanelSwitcher from "@21n/elements/switcher/PanelSwitcher.svelte";
  import Text from "@21n/elements/text/Text.svelte";
  import { appStore, isInEditMode } from "@nucleum/stores/app.store";
  import view from "@nucleum/stores/view.store";
  import { Size } from "@21n/elements/size.enum";
  import { PanelSwitcherStyle } from "@21n/elements/switcher/switcher.enum";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import { onMount } from "svelte";
  import {
    analyticsConfigStore,
    selectedPageId
  } from "@nucleum/features/focus/analytics/analytics.store";
  import AnalyticsPageView from "@nucleum/features/focus/analytics/page/AnalyticsPageView.svelte";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import OptionSelector from "@21n/elements/select/OptionSelector.svelte";
  import { PointronAction } from "@nucleum/client/config/focus-action.enum";
  import {
    onAddPageClicked,
    onPagelabelChange,
    onRemovePageClicked,
    onPageRearrange
  } from "@nucleum/features/focus/analytics/analytics.utils";
  import { confirmationNotification } from "@nucleum/stores/notification.store";
  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
  import { uiState } from "@nucleum/stores/uiState/uiState.store";
  import { UIState, UIStateScope } from "@nucleum/stores/uiState/uiState.type";
  import { bg, cn } from "@21n/utils/ui.utils";
  import { Product } from "@nucleum/client/config/product.type";
  import Switch from "@21n/elements/toggle/Switch.svelte";

  const bgIndex = 2;
  const isNucleusContext = $derived($appStore.product === Product.NUCLEUM);
  const pagesList = $derived($analyticsConfigStore.pages ?? []);
  let isAnalyticsEditMode = $state(false);
  let pages = $derived(
    pagesList.length > 0
      ? pagesList.map((page) => {
          return { label: page.label, value: page.id };
        })
      : []
  );

  function syncSelectedPage() {
    const nextPageId = resolvePageSelection();
    if ($selectedPageId !== nextPageId) {
      $selectedPageId = nextPageId;
    }
  }

  onMount(() => {
    const unsubscribeEditMode = isInEditMode.subscribe((value) => {
      isAnalyticsEditMode = value;
    });
    syncSelectedPage();
    const unsubscribe = uiState.subscribe(() => {
      syncSelectedPage();
    });
    return () => {
      unsubscribeEditMode();
      unsubscribe();
    };
  });

  $effect(() => {
    pagesList;
    if (pagesList.length === 0) {
      if ($selectedPageId !== undefined) {
        $selectedPageId = undefined;
      }
      return;
    }
    const currentExists = pagesList.some((page) => page.id === $selectedPageId);
    if (!currentExists) {
      syncSelectedPage();
    }
  });

  function onPageSwitch(e: CustomEvent<string>) {
    uiState.setState(UIState.analyticsPage, e.detail, {
      scope: UIStateScope.DEVICE
    });
  }

  function resolvePageSelection() {
    const pageState = uiState.getState(UIState.analyticsPage, {
      scope: UIStateScope.DEVICE
    });
    if (
      typeof pageState === "string" &&
      pagesList.some((page) => page.id === pageState)
    ) {
      return pageState;
    }
    return pagesList[0]?.id ?? undefined;
  }

  function setAnalyticsEditMode(nextValue: boolean) {
    isAnalyticsEditMode = nextValue;
    isInEditMode.toggle(nextValue);
  }
</script>

<main class={cn("flex flex-col w-full h-full otop:pt-12", bg(bgIndex - 1))}>
  <div
    class="flex gap-8 w-full items-center justify-between portrait:px-4 portrait:py-2 portrait:pt-4 portrait:pb-2"
  >
    <div class="flex gap-6 items-center flex-grow">
      {#if $view.isPortrait}
        <div class="flex flex-col gap-3 w-full">
          <div class="flex justify-between w-full">
            <Text style={TextStyle.PAGE_HEADING_SUBTLE} content="Overview" />
            <div class="rounded-full flex items-center gap-2 px-3 py-1">
              <span class="text-fgs3 text-b2"> edit: </span>
              <Switch
                on={isAnalyticsEditMode}
                size={Size.sm}
                onChange={(event) => setAnalyticsEditMode(event.detail)}
              />
            </div>
          </div>
          <div class="flex w-full gap-2 items-center">
            <div class="overflow-x-auto">
              {#if pages.length > 0 && $selectedPageId !== undefined}
                <OptionSelector
                  options={pages}
                  size={Size.sm}
                  isPreventWrap={true}
                  bind:selected={$selectedPageId}
                  onSelect={onPageSwitch}
                />
              {/if}
            </div>
            {#if isAnalyticsEditMode}
              <Button
                class="min-w-fit"
                size={Size.xs}
                parentBgIndex={bgIndex}
                icon="pencil-square"
                style={ButtonStyle.OUTLINED}
                onclick={() =>
                  requireCommandHost().runAction(
                    PointronAction.ANALYTICS_VIEWS_PAGE_EDIT_MOBILE
                  )}
              >
                edit</Button
              >{/if}
          </div>
        </div>
      {:else}
        <div class="flex overflow-hidden w-full">
          <div class="overflow-x-auto w-full">
            <PanelSwitcher
              title={isNucleusContext ? "" : "Overview"}
              items={pages}
              style={PanelSwitcherStyle.BAR}
              isExpandToFullWidth={true}
              isEnableAnimationForTitle={false}
              isInEditMode={isAnalyticsEditMode}
              parentBgIndex={bgIndex}
              tempTitleWithActionDisabled={true}
              bind:value={$selectedPageId}
              onSwitch={onPageSwitch}
              onAdd={onAddPageClicked}
              onChange={onPagelabelChange}
              onRemove={onRemovePageClicked}
              onDebouncedChange={onPagelabelChange}
              onRearrange={onPageRearrange}
            >
              {#snippet right()}
                <div class="flex items-center gap-2 mr-3">
                  {#if isAnalyticsEditMode}
                    <Button
                      icon="sync"
                      label="reset"
                      isPreventMinWidth={true}
                      size={Size.xs}
                      onclick={() => {
                        confirmationNotification.notify({
                          title: "Reset analytics",
                          message:
                            "Are you sure you want to reset analytics? This will remove all pages and cards.",
                          confirmAction: {
                            label: "Reset",
                            variant: ButtonVariant.DANGER,
                            callback: async () => {
                              await analyticsConfigStore.reset();
                              return true;
                            }
                          }
                        });
                      }}
                    />
                  {/if}
                  <div class="rounded-full flex items-center gap-2 px-3 py-1">
                    <span class="text-fgs3 text-b2"> edit: </span>
                    <Switch
                      on={isAnalyticsEditMode}
                      size={Size.sm}
                      onChange={(event) => setAnalyticsEditMode(event.detail)}
                    />
                  </div>
                </div>
              {/snippet}
            </PanelSwitcher>
          </div>
        </div>
      {/if}
    </div>
  </div>
  {#key $selectedPageId}
    {#if $selectedPageId}
      <AnalyticsPageView id={$selectedPageId} parentBgIndex={bgIndex} />
    {:else}
      <EmptyStatusView
        subText="Please click on a view to see Analytic cards or click on edit to manage views"
      />
    {/if}
  {/key}
</main>
