<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { pointronPreferences } from "@nucleum/features/focus/preferences.store";
  import { activeSession } from "@nucleum/features/focus/session.store";
  import Button from "@21n/elements/button/Button.svelte";
  import { Size } from "@21n/elements/size.enum";
  import Presets from "@nucleum/features/focus/advanced/presets/Presets.svelte";
  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
  import { cn } from "@21n/utils/ui.utils";

  import { PointronAction } from "@nucleum/client/config/focus-action.enum";
  let {
    isExpandedVariant = true,
    parentBackgroundIndex = 1
  }: {
    isExpandedVariant?: boolean;
    parentBackgroundIndex?: number;
  } = $props();
  let isInEditMode = $state(false);
  let selectedPresetIndex = $state(
    $activeSession.composition
      ? $pointronPreferences.presets.indexOf($activeSession.composition)
      : 0
  );

  async function onPresetSelection(event: any) {
    const preset = event.detail.preset;
    selectedPresetIndex = $pointronPreferences.presets.findIndex(
      (item) => item.id === preset.id
    );
  }

  function onAddNewClicked() {
    selectedPresetIndex = -1;
    showEditor();
  }
  function showEditor(id: string = "") {
    requireCommandHost().runAction(PointronAction.EDIT_PRESET, {
      componentParams: { id }
    });
  }

  function onEdit(event: any) {
    if (!event.detail.id) return;
    showEditor(event.detail.id);
  }
</script>

<div class="flex flex-col w-full flex-grow gap-2">
  <div
    class={cn("flex gap-2 items-center", {
      "w-full flex-col flex-grow": isExpandedVariant,
      "w-72 md:w-96 lg:w-[30rem]": !isExpandedVariant
    })}
  >
    <Presets
      {parentBackgroundIndex}
      {isExpandedVariant}
      {isInEditMode}
      {onEdit}
      onPresetSelect={onPresetSelection}
    />
    {#if isInEditMode}
      <Button
        parentBgIndex={parentBackgroundIndex}
        onclick={onAddNewClicked}
        type={ButtonVariant.PRIMARY}
        style={ButtonStyle.OUTLINED}
        size={Size.sm}
        label="Add new preset"
        icon="plus"
      />
    {/if}
    <div
      class={cn("flex flex-col gap-2 py-3", {
        "pt-12": isInEditMode
      })}
    >
      {#if isExpandedVariant}
        <Button
          size={Size.sm}
          style={ButtonStyle.OUTLINED}
          isPreventMinWidth={true}
          onclick={() => {
            isInEditMode = !isInEditMode;
          }}
          >{isInEditMode ? "Close editor" : "Edit"}
        </Button>
      {:else}
        <button
          class="text-fgs3 text-b2 underline notouch:hover:text-aps1"
          onclick={() => {
            isInEditMode = !isInEditMode;
          }}>{isInEditMode ? "close editor" : "edit"}</button
        >
      {/if}
      {#if isInEditMode}
        <div class="flex w-full justify-center text-fgs4 text-b3">
          Tap the preset to edit
        </div>
      {/if}
    </div>
  </div>
</div>
