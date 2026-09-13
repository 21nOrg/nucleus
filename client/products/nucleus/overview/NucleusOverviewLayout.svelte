<script lang="ts">
  import type { Snippet } from "svelte";
  import { Size } from "@21n/elements/size.enum";
  import view from "@nucleum/stores/view.store";
  import { resizeListener } from "@nucleum/actions/resize.action";
  import PanelSwitcher from "@21n/elements/switcher/PanelSwitcher.svelte";
  import { PanelSwitcherStyle } from "@21n/elements/switcher/switcher.enum";
  import { uiState } from "@nucleum/stores/uiState/uiState.store";

  import { UIState, UIStateScope } from "@nucleum/stores/uiState/uiState.type";
  import { OverviewPanel } from "@nucleum/client/config/product.type";
  import { Product } from "@nucleum/client/config/product.type";
  import { resolveProductConfig } from "@nucleum/products/product.config";

  const overviewPanelSwitcherItems =
    resolveProductConfig(Product.NUCLEUM).overviewPanelSwitcherItems ?? [];

  let {
    isConstrainedWidth = $bindable(false),
    children,
    right
  }: {
    isConstrainedWidth?: boolean;
    children?: Snippet;
    right?: Snippet;
  } = $props();
  let selectedPanel: OverviewPanel = resolveSavedState() ?? OverviewPanel.FOCUS;

  let containerWidth = 0;
  $effect(() => {
    isConstrainedWidth = containerWidth < 1000 || $view.isConstrainedWidth;
  });

  function resolveSavedState() {
    const savedPanel = uiState.getState(UIState.nucleusOverviewPanel, {
      scope: UIStateScope.DEVICE
    });
    if (savedPanel && Object.values(OverviewPanel).includes(savedPanel)) {
      return savedPanel;
    }
  }

  function onPanelSwitch(event: CustomEvent) {
    if (!event.detail || !Object.values(OverviewPanel).includes(event.detail))
      return;
    uiState.setState(UIState.nucleusOverviewPanel, event.detail, {
      scope: UIStateScope.DEVICE
    });
  }
</script>

<div class="relative w-full h-full flex flex-col justify-center items-center">
  <div
    class="flex justify-between items-end gap-4 rounded-md w-full"
    use:resizeListener={(e) => {
      containerWidth = e.width;
    }}
  >
    <PanelSwitcher
      items={overviewPanelSwitcherItems}
      style={PanelSwitcherStyle.BAR}
      title="Overview"
      isExpandToFullWidth={true}
      size={Size.sm}
      bind:value={selectedPanel}
      onSwitch={onPanelSwitch}
    >
      {#snippet right()}
        <div class="mr-3">
          {@render right?.()}
        </div>
      {/snippet}
    </PanelSwitcher>
  </div>
  <div class="relative w-full h-full">
    {@render children?.()}
  </div>
</div>
