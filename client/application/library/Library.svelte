<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import Records from "@nucleum/application/record/Records.svelte";
  import { onMount } from "svelte";
  import { Size } from "@21n/elements/size.enum";
  import { ButtonStyle } from "@21n/elements/button/button.type";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import ResourceSwitcher from "@nucleum/application/library/resourceSwitcher/ResourceSwitcher.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import {
    resourceAction,
    availableResources,
    resolveResourceIcon
  } from "@nucleum/datafn/resource.utils";
  import { ResourceAccessPoint } from "@nucleum/datafn/resource.type";
  import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
  import { recentsStore } from "@nucleum/stores/resources/recent.store";
  import { page } from "$app/stores";
  import view from "@nucleum/stores/view.store";
  import InlineSyncingFeedback from "@21n/elements/feedback/InlineSyncingFeedback.svelte";
  import Panel from "@21n/layout/paint/Panel.svelte";
  import Text from "@21n/elements/text/Text.svelte";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import LibraryRecordsPane from "@nucleum/application/library/LibraryRecordsPane.svelte";
  import ScrollViewBottomSpacer from "@21n/layout/scrollView/ScrollViewBottomSpacer.svelte";
  import LibraryLoadingPulse from "@nucleum/application/library/LibraryLoadingPulse.svelte";
  import { Arrangement, Placement } from "@21n/elements/direction.enum";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import { Action } from "@nucleum/client/config/action.enum";
  import ContextMenu from "@21n/elements/contextMenu/ContextMenu.svelte";
  import ResourceBrowser from "@nucleum/application/library/resourceBrowser/ResourceBrowser.svelte";
  import { Product } from "@nucleum/client/config/product.type";
  import { isHideCreateAction } from "@nucleum/application/library/library.utils";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";
  import ComponentShortcutListener from "@nucleum/components/keyboard/ComponentShortcutListener.svelte";
  import { GlobalEvent } from "@nucleum/stores/notifications/event.enum";
  import { isValidEnumValue } from "@21n/shared-utils/text.utils";

  let { resources = [] }: { resources?: Resource[] } = $props();

  let selectedResource = $state<Resource>(Resource.unknown);
  let syncFeedbackRef = $state<InlineSyncingFeedback>();

  function syncSelectedResource(resourceParam?: string | null) {
    if (resourceParam && isValidEnumValue(resourceParam, Resource)) {
      selectedResource = resourceParam as Resource;
      return;
    }
    if (!resourceParam && $view.isConstrainedWidth) {
      selectedResource = Resource.unknown;
      return;
    }
    if (!$view.isConstrainedWidth && selectedResource === Resource.unknown) {
      selectedResource = resources[0] ?? Resource.unknown;
    }
  }
  let floatingButton = $derived(
    $view.isConstrainedWidth && selectedResource === Resource.unknown
      ? [
          {
            label: "Search",
            callback: async () => {
              requireCommandHost().runAction(Action.SEARCH);
            },
            icon: "search"
          },
          {
            label: "Create",
            popoverAction: {
              content: ContextMenu,
              placement: Placement.TopCenter,
              isRenderAsModalForCW: true,
              componentProps: {
                parentBgIndex: 0,
                isFullWidth: $view.isConstrainedWidth,
                menuResolver: resolveCreateResourceMenu,
                size: Size.lg
              }
            },
            icon: "plus-circle"
          }
        ]
      : !availableResources.has(selectedResource) ||
          isHideCreateAction(selectedResource)
        ? undefined
        : {
            label: "New " + selectedResource,
            callback: async () => {
              onCreateResource();
            },
            icon: "plus",
            parentBgIndex: 2,
            shortcut: Action.CREATE,
            style: ButtonStyle.OUTLINED
          }
  );

  $effect(() => {
    if (!$view.isConstrainedWidth && selectedResource === Resource.unknown) {
      selectedResource = resources[0] ?? Resource.unknown;
    }
  });

  onMount(() => {
    const syncFromWindow = () => {
      const resourceParam = new URL(window.location.href).searchParams.get(
        AppSearchParam.RESOURCE
      );
      syncSelectedResource(resourceParam);
    };
    const pageSub = page.subscribe(async (p) => {
      syncSelectedResource(p.url.searchParams.get(AppSearchParam.RESOURCE));
    });
    window.addEventListener(GlobalEvent.CUSTOM_NAVIGATION, syncFromWindow);
    window.addEventListener("popstate", syncFromWindow);
    syncFromWindow();
    return () => {
      pageSub();
      window.removeEventListener(GlobalEvent.CUSTOM_NAVIGATION, syncFromWindow);
      window.removeEventListener("popstate", syncFromWindow);
    };
  });

  function onCreateResource(resource?: Resource) {
    requireCommandHost().runAction(
      resourceAction(resource ?? selectedResource, ResourceActionType.CREATE)
    );
  }

  function resolveCreateResourceMenu() {
    let resources: Resource[] = [];
    switch ($appStore.product) {
      case Product.POINTRON:
        resources = [
          Resource.task,
          Resource.objective,
          Resource.event,
          Resource.collection
        ];
        break;
      case Product.MEMOTRON:
        resources = [Resource.node, Resource.collection];
        break;
      case Product.NUCLEUM:
        resources = [
          Resource.node,
          Resource.task,
          Resource.objective,
          Resource.event,
          Resource.collection
        ];
        break;
      default:
        resources = [Resource.collection];
    }

    const items = resources.map((resource) => {
      return {
        label: "New " + resource,
        value: resource,
        icon: resolveResourceIcon(resource),
        callback: async () => {
          onCreateResource(resource);
        }
      };
    });
    return [
      {
        group: "all",
        isToggleGroup: $view.isConstrainedWidth,
        items
      }
    ];
  }
</script>

<Panel
  title="Library"
  {floatingButton}
  panelSize={Size.sm}
  isNavActivated={selectedResource !== Resource.unknown &&
    $view.isConstrainedWidth}
  isHideRightSplit={!$view.isPortrait}
>
  {#if $view.isConstrainedWidth}
    <InlineSyncingFeedback
      bind:this={syncFeedbackRef}
      resource={selectedResource}
    />
  {/if}
  <div class="flex mo:py-3 py-5 w-full h-fit shrink-0">
    <ResourceSwitcher
      {resources}
      selected={selectedResource}
      isShowCount={true}
      onSelect={(selectedValue) => {
        selectedResource = selectedValue;
        navigation.toggleSearchParam({
          [AppSearchParam.RESOURCE]: selectedValue,
          [AppSearchParam.TYPE]: "all",
          [AppSearchParam.STARRED]: null,
          [AppSearchParam.ARCHIVED]: null
        });
        syncFeedbackRef?.refresh(selectedValue);
      }}
    />
  </div>
  {#if $view.isConstrainedWidth}
    <div class="flex flex-col gap-2 w-full flex-grow">
      <Text content="Recents" style={TextStyle.SECTION_HEADING} />
      <div class="flex flex-col gap-4 w-full flex-grow">
        {#if !$recentsStore.isInitialized}
          <LibraryLoadingPulse
            arrangement={Arrangement.LIST}
            isConstrainedWidth={true}
          />
        {:else if $recentsStore.recents && $recentsStore.recents.length > 0}
          {@const recentsData = $recentsStore.recents
            .filter((x) => x && x.timestamp)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .map((x) => x.record)}
          <Records
            data={recentsData}
            accessPoint={ResourceAccessPoint.LIBRARY}
            resource={selectedResource}
            size={Size.sm}
          />
          <ScrollViewBottomSpacer />
        {:else}
          <EmptyStatusView
            size={Size.sm}
            isSearchContext={true}
            mainText="No recents found"
          />
        {/if}
      </div>
    </div>
  {/if}
  {#snippet nav()}
    {#if selectedResource !== Resource.unknown}
      <div class="flex flex-grow">
        <ResourceBrowser
          resource={selectedResource}
          isPreventCwPadding={true}
          onBack={() => {
            selectedResource = Resource.unknown;
            navigation.toggleSearchParam([AppSearchParam.RESOURCE]);
          }}
        />
      </div>
    {/if}
  {/snippet}
  {#snippet right()}
    {#if selectedResource !== Resource.unknown}
      <div class="flex flex-col gap-4 w-full">
        {#key selectedResource}
          <LibraryRecordsPane resource={selectedResource} />
        {/key}
      </div>
    {/if}
  {/snippet}
</Panel>

{#if selectedResource !== Resource.task}
  <ComponentShortcutListener
    shortcuts={[
      {
        shortcut: Action.CREATE,
        callback: onCreateResource
      }
    ]}
  />
{/if}
