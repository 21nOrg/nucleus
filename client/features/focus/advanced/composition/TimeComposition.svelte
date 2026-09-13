<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { activeSession } from "@nucleum/features/focus/session.store";
  import Slider from "@nucleum/features/focus/advanced/slider/Slider.svelte";
  import Button from "@21n/elements/button/Button.svelte";
  import { Size } from "@21n/elements/size.enum";
  import { PointronAction } from "@nucleum/client/config/focus-action.enum";
  import AdvancedFocusModeSwitcher from "@nucleum/features/focus/advanced/modeSwitcher/AdvancedFocusModeSwitcher.svelte";
  import ComposeDuration from "@nucleum/features/focus/advanced/composition/ComposeDuration.svelte";
  import PanelSwitcher from "@21n/elements/switcher/PanelSwitcher.svelte";
  import {
    PanelSwitcherActiveItemStrength,
    PanelSwitcherStyle
  } from "@21n/elements/switcher/switcher.enum";
  import PresetPicker from "@nucleum/features/focus/advanced/composition/PresetPicker.svelte";
  import { onMount } from "svelte";
  import {
    SessionCompositionType,
    type SessionComposition
  } from "@nucleum/features/focus/sessionComposition.type";
  import Icon from "@21n/elements/Icon.svelte";
  import ComposeTotalsText from "@nucleum/features/focus/advanced/composition/ComposeTotalsText.svelte";

  import { userPreferences } from "@nucleum/stores/preferences/user-preferences.store";
  import { UIState, UIStateScope } from "@nucleum/stores/uiState/uiState.type";
  import { uiState } from "@nucleum/stores/uiState/uiState.store";
  import { deepCopy } from "@21n/shared-utils/obj.utils";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { cn } from "@21n/utils/ui.utils";
  import { advancedCompositionDraft } from "@nucleum/features/focus/advanced/composition/advancedCompositionDraft.store";

  let { parentBgIndex = 1 }: { parentBgIndex?: number } = $props();
  let selectedMode = $state(refreshAdvancedModeState());
  let selectedDynamicDuration = $state(0);
  let isSliderVariant = $state(false);
  let compositionDraft = $state<SessionComposition>(
    deepCopy($activeSession.composition)
  );
  const visibleComposition = $derived(
    $advancedCompositionDraft ?? compositionDraft
  );
  function onDynamicSliderChange(event: any) {
    if (
      $activeSession.isSessionRunning ||
      $activeSession.preventSliderReverseEventTemp
    )
      return;
    selectedDynamicDuration = Number(event.detail.value);
    activeSession.onSliderDurationChange(selectedDynamicDuration);
  }
  async function onCompositionChanges(event?: CustomEvent<SessionComposition>) {
    compositionDraft = event?.detail ?? compositionDraft;
    advancedCompositionDraft.set(deepCopy(compositionDraft));
    logger.log({
      at: "onCompositionChanges",
      composition: deepCopy(compositionDraft)
    });
    await activeSession.modify(
      { composition: deepCopy(compositionDraft) },
      { isPersist: false }
    );
    activeSession.onComposeComplete();
  }
  function onModeSwitch(event: any) {
    selectedMode = event.detail === "Presets" ? 0 : 1;
    uiState.setState(UIState.focusAdvancedComposeMode, selectedMode, {
      scope: UIStateScope.DEVICE
    });
  }
  onMount(() => {
    advancedCompositionDraft.set(deepCopy($activeSession.composition));
    const userPreferencesUnsub = userPreferences.subscribe(() => {
      selectedMode = refreshAdvancedModeState();
    });

    return () => {
      userPreferencesUnsub();
    };
  });

  function refreshAdvancedModeState() {
    return (
      uiState.getState(UIState.focusAdvancedComposeMode, {
        scope: UIStateScope.DEVICE
      }) ?? 0
    );
  }

  async function clearEndTimeComposition() {
    await activeSession.resetComposition();
    compositionDraft = deepCopy(activeSession.get().composition);
    advancedCompositionDraft.set(deepCopy(activeSession.get().composition));
  }
</script>

<div
  class={cn(
    "relative flex flex-col items-center rounded-lg w-full justify-start gap-4 flex-grow"
  )}
>
  {#if !isSliderVariant}
    <div class="flex flex-col items-center w-full gap-4 dp:gap-8">
      <ComposeTotalsText composition={visibleComposition} {parentBgIndex} />
    </div>
    {#if visibleComposition.type === SessionCompositionType.END_TIME_FIXED}
      <div
        class="py-8 flex flex-col items-center gap-4"
        data-testid="composition-end-time-selected"
      >
        <div class="flex flex-col gap-2 items-center">
          <Icon icon="clock" />
          <div class="text-fgs2">End time selected.</div>
        </div>
        <Button
          label="Clear"
          size={Size.sm}
          icon="cross"
          testId="composition-clear-end-time"
          onclick={clearEndTimeComposition}
        />
      </div>
    {:else}
      <div class="flex w-full justify-center">
        <PanelSwitcher
          style={PanelSwitcherStyle.TRAIN}
          {parentBgIndex}
          items={["Presets", "Custom"]}
          value={selectedMode === 0 ? "Presets" : "Custom"}
          onSwitch={onModeSwitch}
          activeItemStrength={PanelSwitcherActiveItemStrength.SUBTLE}
        />
      </div>
      {#if selectedMode == 0}
        <PresetPicker parentBackgroundIndex={parentBgIndex} />
      {:else}
        <ComposeDuration
          {parentBgIndex}
          composition={visibleComposition}
          isActiveSessionContext={true}
          compositionChangeHandler={onCompositionChanges}
          isShowSave={true}
        />
      {/if}
    {/if}
  {:else}
    <div class="flex flex-col px-4 gap-8">
      <div class="h-32">
        {#if selectedMode == 0}
          <PresetPicker parentBackgroundIndex={parentBgIndex} />
        {:else}
          <div class="relative flex flex-col gap-2 max-w-[19rem]">
            <Slider
              parentBackgroundIndex={parentBgIndex}
              onTimeChange={onDynamicSliderChange}
            />
            <div class="flex justify-center w-full">
              <Button
                label="compose"
                size={Size.xs}
                parentBgIndex={2}
                onclick={() => {
                  requireCommandHost().runAction(
                    PointronAction.COMPOSE_TIME_MODAL
                  );
                }}
              />
            </div>
          </div>
        {/if}
      </div>
    </div>
    <AdvancedFocusModeSwitcher {selectedMode} onSwitch={onModeSwitch} />
  {/if}
</div>
