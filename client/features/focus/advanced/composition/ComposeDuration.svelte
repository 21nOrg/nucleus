<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import Button from "@21n/elements/button/Button.svelte";
  import {
    SessionCompositionType,
    type SessionComposition,
    BreakCompositionType
  } from "@nucleum/features/focus/sessionComposition.type";
  import { getTotalsFromComposition } from "@nucleum/features/focus/composition.utils";
  import DurationInput from "@21n/elements/input/durationInput/DurationInput.svelte";
  import { Orientation } from "@21n/elements/direction.enum";
  import PomodoroUnitView from "@nucleum/features/focus/advanced/presets/PomodoroUnitView.svelte";
  import ComposeBreak from "@nucleum/features/focus/advanced/composition/ComposeBreak.svelte";
  import { PointronAction } from "@nucleum/client/config/focus-action.enum";
  import { Size } from "@21n/elements/size.enum";
  import { ButtonStyle } from "@21n/elements/button/button.type";

  import ScrollViewBottomSpacer from "@21n/layout/scrollView/ScrollViewBottomSpacer.svelte";
  import { generateSimpleRandomId } from "@21n/shared-utils/crypto.utils";
  import { deepCopy } from "@21n/shared-utils/obj.utils";
  import { activeSession } from "@nucleum/features/focus/session.store";
  import { advancedCompositionDraft } from "@nucleum/features/focus/advanced/composition/advancedCompositionDraft.store";
  import BackButton from "@21n/elements/button/BackButton.svelte";
  import Text from "@21n/elements/text/Text.svelte";
  import Icon from "@21n/elements/Icon.svelte";
  import { TextStyle } from "@21n/elements/text/text.enum";

  let {
    composition,
    isShowSave = false,
    isActiveSessionContext = false,
    parentBgIndex = 1,
    startInConfig = false,
    compositionChangeHandler = undefined,
    onChange = undefined,
    onCompositionChange = undefined
  }: {
    composition: SessionComposition;
    isShowSave?: boolean;
    isActiveSessionContext?: boolean;
    parentBgIndex?: number;
    startInConfig?: boolean;
    compositionChangeHandler?:
      ((event: CustomEvent<SessionComposition>) => void) | undefined;
    onChange?: ((event: CustomEvent<SessionComposition>) => void) | undefined;
    onCompositionChange?:
      ((event: CustomEvent<SessionComposition>) => void) | undefined;
  } = $props();
  void parentBgIndex;

  const compositionModes = [
    {
      id: "Countup",
      label: "Countup",
      icon: "ph:infinity",
      description:
        "Run without a fixed end time. Get reminded to take breaks along the way."
    },
    {
      id: "Pomodoro",
      label: "Pomodoro",
      icon: "pomodoro",
      description: "Alternate focus rounds and breaks with set durations."
    },
    {
      id: "Countdown",
      label: "Countdown",
      icon: "ph:timer",
      description:
        "Focus for a fixed total duration, with optional reminder or predefined breaks."
    },
    {
      id: "Target duration",
      label: "Target duration",
      icon: "ph:target",
      description:
        "Keep going until you reach a focus-time target. Get reminded to take breaks; end time adjusts when you do."
    }
  ] as const;

  type CompositionModeId = (typeof compositionModes)[number]["id"];

  function resolveInitialComposition() {
    const draft = deepCopy(composition);
    if (draft.type === SessionCompositionType.SLIDER) {
      draft.type = SessionCompositionType.TOTAL_DURATION;
    }
    return draft;
  }

  function resolveModeFromType(
    type: SessionCompositionType
  ): CompositionModeId {
    if (type === SessionCompositionType.POMODORO) return "Pomodoro";
    if (type === SessionCompositionType.COUNTUP) return "Countup";
    if (type === SessionCompositionType.TARGET_FOCUS) return "Target duration";
    return "Countdown";
  }

  let compositionDraft = $state<SessionComposition>(
    resolveInitialComposition()
  );
  let selectedMode = $state<CompositionModeId | null>(
    startInConfig ? resolveModeFromType(compositionDraft.type) : null
  );

  function generateSeedPomodoroRound() {
    const id = generateSimpleRandomId();
    return {
      id,
      type: SessionCompositionType.POMODORO,
      numberOfFocusRounds: 2,
      focusDuration: 28 * 60,
      breakDuration: 2 * 60,
      totalDuration: 0,
      numberOfBreaks: 1,
      breakReminder: 0,
      breakType: BreakCompositionType.PREDEFINED
    };
  }

  let totals = $derived(
    getTotalsFromComposition({
      composition: compositionDraft,
      endTime: $activeSession.end
    })
  );

  function resolveUsableDuration(duration?: number) {
    return duration && duration >= 60 ? duration : 0;
  }

  function applySelectedMode(nextMode: CompositionModeId) {
    let nextComposition = compositionDraft;
    if (nextMode === "Pomodoro") {
      nextComposition = {
        ...compositionDraft,
        type: SessionCompositionType.POMODORO,
        numberOfFocusRounds: compositionDraft.numberOfFocusRounds || 2,
        focusDuration:
          resolveUsableDuration(compositionDraft.focusDuration) || 28 * 60,
        breakDuration:
          resolveUsableDuration(compositionDraft.breakDuration) || 2 * 60,
        breakType: BreakCompositionType.PREDEFINED
      };
    } else if (nextMode === "Countdown") {
      const totalDuration =
        resolveUsableDuration(totals.duration) ||
        resolveUsableDuration(compositionDraft.totalDuration) ||
        resolveUsableDuration(compositionDraft.focusDuration) ||
        60 * 60;
      nextComposition = {
        ...compositionDraft,
        type: SessionCompositionType.TOTAL_DURATION,
        numberOfBreaks: compositionDraft.numberOfBreaks || 0,
        breakDuration: compositionDraft.breakDuration || 0,
        totalDuration,
        breakType: compositionDraft.breakType || BreakCompositionType.REMINDER
      };
    } else if (nextMode === "Countup") {
      nextComposition = {
        ...compositionDraft,
        type: SessionCompositionType.COUNTUP,
        breakType: BreakCompositionType.REMINDER
      };
    } else if (nextMode === "Target duration") {
      const focusDuration =
        resolveUsableDuration(compositionDraft.focusDuration) ||
        resolveUsableDuration(compositionDraft.totalDuration) ||
        60 * 60;
      nextComposition = {
        ...compositionDraft,
        type: SessionCompositionType.TARGET_FOCUS,
        focusDuration,
        breakType: BreakCompositionType.REMINDER
      };
    }
    compositionDraft = nextComposition;
    selectedMode = nextMode;
    emitChange(nextComposition);
  }

  function backToModeList() {
    selectedMode = null;
  }

  function emitChange(nextComposition: SessionComposition = compositionDraft) {
    if (isActiveSessionContext || isShowSave) {
      advancedCompositionDraft.set(deepCopy(nextComposition));
      activeSession.modify(
        { composition: deepCopy(nextComposition) },
        { isPersist: false }
      );
      activeSession.onComposeComplete(false);
    }
    const changeEvent = new CustomEvent<SessionComposition>("change", {
      detail: deepCopy(nextComposition)
    });
    compositionChangeHandler?.(changeEvent);
    onCompositionChange?.(changeEvent);
    onChange?.(changeEvent);
  }

  function handlePrimaryPomodoroChange(event: CustomEvent<SessionComposition>) {
    const nextComposition = event.detail ?? compositionDraft;
    compositionDraft = nextComposition;
    emitChange(nextComposition);
  }

  function normalizeDurationInputValue(event: CustomEvent<{ value: number }>) {
    const numericValue = Number(event.detail?.value);
    return Number.isFinite(numericValue) ? numericValue : 0;
  }

  function updateTotalDuration(event: CustomEvent<{ value: number }>) {
    const nextComposition = {
      ...compositionDraft,
      totalDuration: normalizeDurationInputValue(event)
    };
    compositionDraft = nextComposition;
    emitChange(nextComposition);
  }

  function updateFocusDuration(event: CustomEvent<{ value: number }>) {
    const nextComposition = {
      ...compositionDraft,
      focusDuration: normalizeDurationInputValue(event)
    };
    compositionDraft = nextComposition;
    emitChange(nextComposition);
  }

  function removeAdditionalHandler(event: any) {
    const nextComposition = {
      ...compositionDraft,
      additional: compositionDraft.additional?.filter(
        (x) => x.id !== event?.detail?.preset?.id
      )
    };
    compositionDraft = nextComposition;
    emitChange(nextComposition);
  }

  function onAddAdditionalClicked() {
    const nextComposition = {
      ...compositionDraft,
      additional: [
        ...(compositionDraft.additional ?? []),
        generateSeedPomodoroRound()
      ]
    };
    compositionDraft = nextComposition;
    emitChange(nextComposition);
  }

  function onEachAdditionalEdit(item: SessionComposition) {
    if (!item) return;
    let presetToBeSaved = { ...item };
    if (presetToBeSaved?.id !== compositionDraft.id) {
      const nextComposition = {
        ...compositionDraft,
        additional: [
          ...(compositionDraft.additional?.filter(
            (x) => x.id !== presetToBeSaved.id
          ) ?? []),
          presetToBeSaved
        ]
      };
      compositionDraft = nextComposition;
      emitChange(nextComposition);
    }
  }

  const selectedModeLabel = $derived(
    compositionModes.find((mode) => mode.id === selectedMode)?.label ?? ""
  );
</script>

<div class="flex flex-col items-center flex-grow w-full my-2 gap-4">
  {#if selectedMode === null}
    <div class="w-full text-b2 text-fgs2">Choose a focus mode</div>
    <div
      class="flex flex-col w-full gap-3 flex-grow"
      data-testid="composition-mode-list"
    >
      {#each compositionModes as mode}
        <button
          type="button"
          class="flex items-center gap-3 w-full text-left p-4 rounded-md border border-brs3 bg-bgs2 hover:bg-bgs3 transition-colors"
          data-testid={`composition-mode-${mode.id.toLowerCase().replace(/\s+/g, "-")}`}
          onclick={() => applySelectedMode(mode.id)}
        >
          <span
            class="flex items-center justify-center shrink-0 w-10 h-10 rounded-md text-fgs2"
          >
            <Icon icon={mode.icon} size={Size.md} />
          </span>
          <span class="flex flex-col gap-1 min-w-0 flex-1">
            <span class="text-b1 text-fgs1 line-clamp-1 h-[1lh]"
              >{mode.label}</span
            >
            <span class="text-b3 text-fgs3 line-clamp-2 h-[2lh]"
              >{mode.description}</span
            >
          </span>
        </button>
      {/each}
    </div>
  {:else}
    <div class="flex items-center justify-between w-full gap-2">
      <div
        class="flex items-center min-w-0 gap-2"
        data-testid="composition-mode-config-header"
      >
        <BackButton isPreventDefault={true} onclick={backToModeList} />
      </div>
      <Text style={TextStyle.PANEL_HEADING_SMALL} content={selectedModeLabel} />
      {#if isShowSave}
        <Button
          icon="bookmark"
          testId="composition-save-as-preset"
          onclick={() => {
            requireCommandHost().runAction(PointronAction.SAVE_PRESET_MODAL);
          }}
          tooltip="Save as preset"
        />
      {/if}
    </div>
    <div
      class="flex flex-col w-full flex-grow gap-8"
      data-testid="composition-mode-config"
      data-composition-mode={selectedMode}
    >
      {#if selectedMode === "Pomodoro"}
        <div class="flex flex-col gap-6 items-center h-96 overflow-y-auto">
          <PomodoroUnitView
            bind:composition={compositionDraft}
            onChange={handlePrimaryPomodoroChange}
          />
          {#if compositionDraft.additional && compositionDraft.additional.length > 0}
            {#each compositionDraft.additional as item}
              <PomodoroUnitView
                composition={item}
                onRemove={removeAdditionalHandler}
                onChange={() => onEachAdditionalEdit(item)}
                isShowRemove={true}
              />
            {/each}
          {/if}
          <div class="mb-40">
            <Button
              onclick={onAddAdditionalClicked}
              style={ButtonStyle.OUTLINED}
              size={Size.sm}
              icon="plus"
              label="add another round"
            />
          </div>
        </div>
      {:else if selectedMode === "Countdown"}
        <div class="flex flex-col gap-6 overflow-y-auto">
          <DurationInput
            bind:value={compositionDraft.totalDuration}
            label={{
              label: "Total duration",
              orientation: Orientation.Vertical
            }}
            onChange={updateTotalDuration}
            testId="advanced-focus-total-duration"
          />
          <ComposeBreak
            bind:composition={compositionDraft}
            onChange={(event) => {
              compositionDraft = event.detail;
              emitChange(event.detail);
            }}
          />
          <ScrollViewBottomSpacer />
        </div>
      {:else if selectedMode === "Target duration"}
        <div class="flex flex-col gap-6 overflow-y-auto">
          <DurationInput
            bind:value={compositionDraft.focusDuration}
            label={{
              label: "Focus target duration",
              orientation: Orientation.Vertical
            }}
            onChange={updateFocusDuration}
            testId="advanced-focus-target-duration"
          />
          <ComposeBreak
            bind:composition={compositionDraft}
            reminderOnly={true}
            onChange={(event) => {
              compositionDraft = event.detail;
              emitChange(event.detail);
            }}
          />
          <ScrollViewBottomSpacer />
        </div>
      {:else}
        <div class="flex flex-col gap-6 overflow-y-auto">
          <ComposeBreak
            bind:composition={compositionDraft}
            reminderOnly={true}
            onChange={(event) => {
              compositionDraft = event.detail;
              emitChange(event.detail);
            }}
          />
          <ScrollViewBottomSpacer />
        </div>
      {/if}
    </div>
  {/if}
</div>
