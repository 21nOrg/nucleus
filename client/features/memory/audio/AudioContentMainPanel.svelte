<script lang="ts">
  import Button from "@21n/elements/button/Button.svelte";
  import NodularMarkdown from "@nucleum/features/memory/markdown/NodularMarkdown.svelte";
  import { InputStyle } from "@21n/elements/input/input.type";
  import view from "@nucleum/stores/view.store";
  import { generateSimpleRandomId } from "@21n/shared-utils/crypto.utils";
  import Icon from "@21n/elements/Icon.svelte";
  import { type IJobStatus } from "@nucleum/client/runtime/inference/taco.type";
  import InlineErrorMessage from "@21n/elements/text/InlineErrorMessage.svelte";
  import TranscriptionWithTimestamps from "@nucleum/features/memory/audio/TranscriptionWithTimestamps.svelte";
  import TextInput from "@21n/elements/input/TextInput.svelte";
  import { Size } from "@21n/elements/size.enum";
  import { copyToClipboard } from "@21n/utils/utils";
  import { renderMdAsHtml } from "@21n/elements/markdown/markdown.utils";
  import { toasts } from "@nucleum/stores/notification.store";
  import PanelSwitcher from "@21n/elements/switcher/PanelSwitcher.svelte";
  import {
    PanelSwitcherActiveItemStrength,
    PanelSwitcherStyle
  } from "@21n/elements/switcher/switcher.enum";
  import { AudioView } from "@nucleum/features/memory/audio/audio.type";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import { Action } from "@nucleum/client/config/action.enum";
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";
  import { generateMarkdownText } from "@nucleum/features/memory/node/node.utils";
  import type { IAudioBody, IAudioMetadata } from "@nucleum/features/memory/node/node.type";
  import { datafn } from "@nucleum/datafn/datafn.store";

  let {
    body,
    nodeId,
    metadata,
    selectedView = $bindable(AudioView.TRANSCRIPTION),
    transcriptionStatus = null,
    transcriptionProgress = 0,
    previewCountDown = 0,
    errorMessage = null,
    isTranscribeAvailable = false,
    onSeek = undefined,
    onTranscribe = undefined,
    onRetranscribe = undefined,
    onReparse = undefined
  }: {
    body: IAudioBody;
    nodeId: string;
    metadata: IAudioMetadata;
    selectedView?: AudioView;
    transcriptionStatus?: IJobStatus | null;
    transcriptionProgress?: number;
    previewCountDown?: number;
    errorMessage?: string | null;
    isTranscribeAvailable?: boolean;
    onSeek?: ((detail: { time: number }) => void) | undefined;
    onTranscribe?: (() => void) | undefined;
    onRetranscribe?: (() => void) | undefined;
    onReparse?: (() => void) | undefined;
  } = $props();

  const isEnableSummarization = import.meta.env?.DEV;
  const isShowTranscriptionProgress = import.meta.env?.DEV;

  // Search functionality
  let isSearchExpanded: boolean = false;
  let searchQuery: string = "";
  let searchInputRef: TextInput;

  function toggleSearch() {
    isSearchExpanded = !isSearchExpanded;
    if (isSearchExpanded) {
      setTimeout(() => {
        searchInputRef?.focus();
      }, 100);
    } else {
      searchQuery = "";
    }
  }

  function highlightSearchMatches(text: string, query: string): string {
    if (!query || !text) return text;
    const regex = new RegExp(
      query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "gi"
    );
    return text.replace(regex, (match) => "`**" + match + "**`");
  }

  function removeTimestamps(text: string): string {
    if (!text) return "";
    // Remove timestamp patterns like [0.00 - 5.32]
    return text.replace(/\[\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?\]/g, "").trim();
  }

  function copyTranscription() {
    if (!body?.transcription) return;
    if (selectedView === AudioView.TRANSCRIPTION) {
      const cleanText = removeTimestamps(body.transcription);
      copyToClipboard(cleanText);
      toasts.success("Transcription copied to clipboard");
    } else if (selectedView === AudioView.SUMMARY && body.summary) {
      copyToClipboard(body.summary);
      toasts.success("Summary copied to clipboard");
    } else if (selectedView === AudioView.MARKDOWN && body.mdBlocks) {
      const markdownAsText = generateMarkdownText(body.mdBlocks);
      copyToClipboard(markdownAsText);
      toasts.success("Markdown copied to clipboard");
    }
  }

  async function onMarkdownChange(event: any) {
    if (!event?.detail?.md?.blocks) return;
    await datafn.node.mutate({
      operation: "merge",
      id: nodeId,
      record: {
        body: { mdBlocks: event.detail.md.blocks }
      },
      debounceKey: "audio-markdown-change",
      debounceMs: 1500
    });
  }

  function hasTimestamps(transcription: string): boolean {
    if (!transcription) return false;
    const timestampRegex = /\[\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?\]/;
    return timestampRegex.test(transcription);
  }

  function handleSeek(detail: { time: number }) {
    onSeek?.(detail);
  }

  function resolveViewItems() {
    let items = [
      {
        value: AudioView.TRANSCRIPTION,
        label: "Transcription",
        icon: "ph:file-text-light"
      },
      {
        value: AudioView.MARKDOWN,
        label: "Markdown",
        icon: "markdown"
      }
    ];
    if (isEnableSummarization) {
      items.push({
        value: AudioView.SUMMARY,
        label: "Summary",
        icon: "sparkle"
      });
    }
    if ($view.isConstrainedWidth) {
      return items.map((item) => ({
        ...item,
        icon: undefined
      }));
    }
    return items;
  }
</script>

<div
  class="flex flex-col w-full flex-1 overflow-auto items-center cw:gap-2 gap-4 border- border-brs2 rounded-md bg--bgs2 bg--opacity-30 py-2"
>
  <div class="cw:flex cw:justify-between grid grid-cols-3 w-full gap-3 px-3">
    <!-- <Text content="Transcription" style={TextStyle.PANEL_HEADING_SMALL} /> -->
    {#if !$view.isConstrainedWidth}
      <span />
    {/if}
    <div class="flex justify-center">
      <PanelSwitcher
        items={resolveViewItems()}
        bind:value={selectedView}
        style={PanelSwitcherStyle.TRAIN}
        activeItemStrength={PanelSwitcherActiveItemStrength.SUBTLE}
        size={Size.sm}
        isRenderDropdownForCW={true}
      />
    </div>
    <div class="flex items-center gap-2 justify-end">
      {#if isSearchExpanded}
        <div class="flex items-center gap-2">
          <TextInput
            bind:this={searchInputRef}
            bind:value={searchQuery}
            placeholder="Search transcription..."
            size={Size.sm}
            style={InputStyle.PLAIN}
            icon="search"
            isShowClearControl={true}
            onCancel={toggleSearch}
          />
        </div>
      {:else if selectedView === AudioView.TRANSCRIPTION && body?.transcription}
        <Button
          icon="search"
          tooltip="Search transcription"
          onclick={toggleSearch}
        />
        {#if import.meta.env?.DEV}
          <Button
            icon="code"
            tooltip="Reparse markdown"
            onclick={() => {
              onReparse?.();
            }}
          />
        {/if}
        {#if isTranscribeAvailable}
          <Button
            icon="reload"
            tooltip="Retranscribe"
            onclick={() => {
              onRetranscribe?.();
            }}
          />
        {/if}
      {/if}
      {#if !isSearchExpanded}
        {#if body?.transcription}
          <Button
            icon="copy"
            tooltip={selectedView === AudioView.TRANSCRIPTION
              ? "Copy transcription"
              : selectedView === AudioView.SUMMARY
                ? "Copy summary"
                : "Copy markdown"}
            onclick={copyTranscription}
          />
        {/if}
        {#if isTranscribeAvailable}
          <Button
            icon="ph:sliders-light"
            tooltip="Transcription settings"
            onclick={() => {
              requireCommandHost().runAction(Action.ARTIFICIAL_INTELLIGENCE);
            }}
          />
        {/if}
      {/if}
    </div>
  </div>
  <div class="flex w-full flex-1 overflow-auto">
    {#if errorMessage}
      <div class="w-full px-3 text-center">
        <InlineErrorMessage error={errorMessage} isDissappear={false} />
      </div>
    {:else if selectedView === AudioView.MARKDOWN}
      {#if !body?.mdBlocks}
        <EmptyStatusView
          mainText="Markdown not available"
          subText="Please transcribe the audio to view the markdown."
        />
      {:else}
        <div class="cw:px-2 cw:pr-2 pr-10 overflow-auto">
          <NodularMarkdown
            mdId={generateSimpleRandomId()}
            isNodular={true}
            md={{ blocks: body?.mdBlocks }}
            onChange={onMarkdownChange}
          />
        </div>
      {/if}
    {:else if selectedView === AudioView.TRANSCRIPTION}
      {#if body?.transcription !== undefined && body?.initTranscription !== true}
        <div class="cw:px-2 px-3 w-full h-full">
          {#if body.transcription && hasTimestamps(body.transcription)}
            <TranscriptionWithTimestamps
              transcription={searchQuery && searchQuery.length > 1
                ? highlightSearchMatches(body.transcription, searchQuery)
                : body.transcription}
              currentTime={previewCountDown}
              groupSegments={true}
              maxGroupGapSeconds={3}
              minGroupDuration={8}
              onSeek={handleSeek}
            />
          {:else if searchQuery && searchQuery.length > 1 && body.transcription}
            {@html renderMdAsHtml(
              highlightSearchMatches(body.transcription, searchQuery)
            )}
          {:else if body.transcription}
            <p>{body.transcription}</p>
          {/if}
        </div>
      {:else}
        <div class="w-full h-full cw:px-2 px-3">
          <div
            class="flex items-center justify-center gap-2 p-2 w-full h-full rounded-md border border-brs2"
          >
            {#if body?.initTranscription === true && transcriptionStatus?.status === "running"}
              <div class="flex flex-col items-center justify-center gap-2">
                <div class="flex gap-2">
                  <Icon icon="svg-spinners:3-dots-fade" />
                  <span class="text-fgs3">
                    {#if body?.transcription}
                      Retranscribing...
                    {:else}
                      Transcribing...
                    {/if}
                    {#if isShowTranscriptionProgress && transcriptionProgress > 0}
                      {transcriptionProgress}%
                    {/if}
                  </span>
                </div>
                <span class="text-fgs3 text-b3 text-center">
                  Audio > 5 minutes will take longer to transcribe if bigger
                  models are used. Please come back later to view the
                  transcription.
                </span>
              </div>
            {:else if body?.transcription}
              <p>{body.transcription}</p>
            {:else}
              {@const isOverDurationLimit =
                metadata?.duration && metadata?.duration > 10 * 60}
              <EmptyStatusView
                mainText={isTranscribeAvailable
                  ? "Not transcribed yet"
                  : isOverDurationLimit
                    ? "Audio too long"
                    : "Transcription not available"}
                subText={isTranscribeAvailable
                  ? "Please click on transcribe to start the transcription."
                  : isOverDurationLimit
                    ? "Transcription is currently not available for audio longer than 15 minutes"
                    : "Transcription is not available on this platform yet. Please use the transcription feature from iOS or macOS app."}
                actionText={isTranscribeAvailable ? "Transcribe" : undefined}
                size={Size.sm}
                isNotAvailableContext={!isTranscribeAvailable}
                onclick={() => {
                  onTranscribe?.();
                }}
              />
            {/if}
          </div>
        </div>
      {/if}
    {/if}
  </div>
  <!-- {#if isTranscribeAvailable}
<div class="text-b3 text-fgs3 px-2">
  Note: Transcription is currently only available for English language.
  We are working to expand this to other languages.
</div>
{/if} -->
</div>
