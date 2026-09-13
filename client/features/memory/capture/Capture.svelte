<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import Writer from "@nucleum/features/memory/capture/Writer.svelte";
  import Button from "@21n/elements/button/Button.svelte";
  import { ButtonVariant } from "@21n/elements/button/button.type";
  import { acquireDnDPage, isInEditMode } from "@nucleum/stores/app.store";
  import { cn } from "@21n/utils/ui.utils";
  import TypeSelector from "@nucleum/features/memory/capture/TypeSelector.svelte";
  import { Size } from "@21n/elements/size.enum";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import { CaptureMethod } from "@nucleum/features/memory/capture/capture.type";
  import FileUploader from "@nucleum/features/memory/capture/FileUploader.svelte";
  import { onDestroy, onMount, setContext } from "svelte";
  import { page } from "$app/stores";
  import Icon from "@21n/elements/Icon.svelte";
  import view from "@nucleum/stores/view.store";
  import context from "@nucleum/stores/context.store";
  import { OperatingSystem } from "@nucleum/client/runtime/context.type";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import { generateResourceId } from "@nucleum/datafn/id.utils";
  import { postMessageToParent } from "@nucleum/client/runtime/embed/embed.utils";
  import { EmbedMessage } from "@nucleum/client/runtime/embed/embedMessage.enum";
  import { appEvents } from "@nucleum/stores/events/app-events.store";
  import type { IEvent } from "@21n/elements/input/event.type";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  import {
    ActiveCaptureStore,
    type IActiveCaptureStore
  } from "@nucleum/features/memory/capture/capture.store";
  import CaptureDraftsAction from "@nucleum/features/memory/capture/draftSelector/CaptureDraftsAction.svelte";
  import ScrollViewBottomSpacer from "@21n/layout/scrollView/ScrollViewBottomSpacer.svelte";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";
  import { GlobalEvent } from "@nucleum/stores/notifications/event.enum";
  import CaptureTopBar from "@nucleum/features/memory/capture/CaptureTopBar.svelte";
  import WebCaptureModal from "@nucleum/features/memory/capture/web/WebCaptureModal.svelte";
  import type { WebArtifact } from "@nucleum/features/memory/capture/web/webCapture.types";
  import { fly } from "svelte/transition";

  import ComponentShortcutListener from "@nucleum/components/keyboard/ComponentShortcutListener.svelte";
  import { MemotronAction } from "@nucleum/features/memory/memory-action.enum";

  import { Context } from "@nucleum/stores/appStore.type";
  import EdgeButton from "@21n/elements/button/EdgeButton.svelte";

  let {
    captureId = generateResourceId(Resource.capture),
    isWindowDnD = false
  }: {
    captureId?: IRecordId;
    isWindowDnD?: boolean;
  } = $props();
  const captureContext = {
    id: captureId
  };

  setContext(Context.CAPTURE, captureContext);
  let captureStore = $state<IActiveCaptureStore>(
    ActiveCaptureStore.resolve(captureId)
  );
  isInEditMode.set(true);
  let writerRef: Writer | undefined = undefined;
  let subs: any[] = [];
  let releaseDnDPage: (() => void) | undefined;
  let isWebModalOpen = $state(false);
  let captureTopBarRef: CaptureTopBar | undefined = undefined;

  const isShowBottomCloseButton = $derived(
    !$view.isConstrainedWidth && $captureStore?.isEmpty
  );

  $effect(() => {
    captureContext.id = captureId;
    captureStore = ActiveCaptureStore.resolve(captureId);
  });

  onMount(async () => {
    if (!isWindowDnD) {
      releaseDnDPage = acquireDnDPage();
    }
    const appEventSub = appEvents.subscribe(async (x: IEvent) => {
      if (x.event === GlobalEvent.ENTER && x.value.metaKey === true) {
        await captureStore.save();
      }
    });
    subs.push(appEventSub);
    const captureType = isWindowDnD
      ? CaptureMethod.UPLOAD
      : CaptureMethod.MARKDOWN;
    if (captureType !== CaptureMethod.MARKDOWN && !isWindowDnD) {
      reset();
    }
    const linkQueryParam = $page.url.searchParams.get(AppSearchParam.LINK);
    const bulkQueryParam = $page.url.searchParams.get(AppSearchParam.BULK);
    const clipBoardQueryParam = $page.url.searchParams.get(
      AppSearchParam.CLIPBOARD
    );
    await captureStore.init({
      isWindowDnD,
      linkQueryParam,
      bulkQueryParam,
      clipBoardQueryParam,
      method: captureType
    });
  });

  onDestroy(() => {
    if (!isWindowDnD) {
      releaseDnDPage?.();
    }
    subs.forEach((x) => x());
    setTimeout(() => {
      navigation.toggleSearchParam([
        AppSearchParam.LINK,
        AppSearchParam.BULK,
        AppSearchParam.CLIPBOARD
      ]);
    }, 100);
  });

  async function onTypeSelect(selected: string) {
    await captureStore.onTypeSelect(selected);
    if (selected === CaptureMethod.WEB) {
      isWebModalOpen = true;
    } else {
      isWebModalOpen = false;
    }
  }

  function reset() {
    captureStore.reset();
    if ($view.isConstrainedWidth) {
      navigation.closeResource({ accessMode: AccessMode.POP });
    }
    postMessageToParent(EmbedMessage.MENU_ITEM_SELECTED);
  }

  async function onSave() {
    await captureStore.save();
    reset();
  }

  function handleWebArtifactAdd({
    item: artifact
  }: {
    item: WebArtifact;
    tab: string;
  }) {
    if (!artifact) return;
    isWebModalOpen = false;
  }

  function handleWebArtifactPreview({
    item: artifact
  }: {
    item: WebArtifact;
    tab: string;
  }) {
    if (!artifact) return;
    const url =
      artifact.externalUrl ??
      artifact.providers?.find((provider) => provider.url)?.url;
    if (url && typeof window !== "undefined") {
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          console.warn("Blocked non-HTTP(S) URL:", url);
          return;
        }
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (error) {
        console.error("Invalid URL:", url, error);
      }
    }
  }

  $effect(() => {
    if ($captureStore.method !== CaptureMethod.WEB && isWebModalOpen) {
      isWebModalOpen = false;
    }
  });
</script>

{#if $captureStore.isSaving && $captureStore.method !== CaptureMethod.UPLOAD}
  <EmptyStatusView isLoadingState={true} loadingText="Saving..." />
{:else}
  {#key $captureStore.refreshId}
    <div
      class="w-full h-full flex justify-center otop:pt-12"
      id={`mdcontainer-${$captureStore.id}`}
    >
      <div
        class={cn("w-full max-w-5xl h-full flex flex-col px-4 pt-4 bg-bgs1", {
          "pb-4": !isShowBottomCloseButton
        })}
      >
        {#if !$captureStore.isSaving}
          <CaptureTopBar
            bind:this={captureTopBarRef}
            {captureStore}
            onFocusBody={() => writerRef?.focus()}
            onClear={reset}
            {onSave}
          />
        {/if}
        <main class="flex flex-col gap-6 w-full flex-grow">
          <div
            class={cn("w-full", {
              "h-48 min-h-48": $captureStore.isEmpty,
              "h-full": !$captureStore.isEmpty
            })}
          >
            {#if $captureStore.method === CaptureMethod.UPLOAD && !($context.isEmbed && $context.os === OperatingSystem.IOS)}
              <FileUploader {captureStore} onClear={reset} />
            {:else if $captureStore.method === CaptureMethod.WEB}
              <div
                class="flex h-full w-full flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-brs3 bg-bgs2/60 px-6 text-center"
              >
                <Icon icon="globe-alt" size={Size.lg} class="text-fgs3" />
                <div class="max-w-md text-b3 text-fgs3">
                  Search movies, books, podcasts, and recipes from the web and
                  add them to this capture.
                </div>
                <Button
                  label="Open Add from Web"
                  type={ButtonVariant.PRIMARY}
                  size={Size.md}
                  onclick={() => {
                    isWebModalOpen = true;
                  }}
                />
              </div>
            {:else}
              <Writer
                {captureStore}
                bind:this={writerRef}
                onChange={(e) => {
                  captureStore.onMdContentChanges(e);
                }}
                onClear={reset}
              />
            {/if}
          </div>
          {#if $captureStore.isEmpty}
            <div class="flex flex-col gap-8 w-full dp:px-12 dp:my-10">
              <TypeSelector
                selected={$captureStore.method}
                isHideTypeShortcuts={$captureStore.isCaptureFromCollectionPage}
                onSelect={onTypeSelect}
                onCapture={captureStore.handleCapture}
              />
              <CaptureDraftsAction
                onSelect={(draft) => {
                  captureId = draft.id;
                  captureStore = ActiveCaptureStore.resolve(captureId);
                  captureStore.load(draft);
                }}
              />
              {#if $view.isConstrainedWidth}
                <ScrollViewBottomSpacer size={Size.sm} />
              {/if}
            </div>
          {/if}
        </main>

        {#if $view.isConstrainedWidth && ($captureStore.isEmpty || $captureStore.method === CaptureMethod.AUDIO)}
          <div
            class="w-full flex justify-center mb-5"
            in:fly={{ y: -100, duration: 250 }}
          >
            <button
              class="flex w-12 h-12 text-fgs3 hover:bg-bgs3 bg-bgs2 rounded-full items-center justify-center"
              onclick={reset}
            >
              <Icon icon="cross" />
            </button>
          </div>
        {/if}
        {#if isShowBottomCloseButton}
          <div class="w-full flex justify-center">
            <EdgeButton
              icon="cross"
              tooltip="Close capture"
              label="Close"
              onclick={() => {
                navigation.closeResource({ accessMode: AccessMode.MAIN });
              }}
            />
          </div>
        {/if}
      </div>
    </div>
  {/key}
{/if}

<WebCaptureModal
  open={isWebModalOpen}
  onClose={() => {
    isWebModalOpen = false;
  }}
  onAdd={handleWebArtifactAdd}
  onPreview={handleWebArtifactPreview}
/>

<ComponentShortcutListener
  isAllowFromTextInput={true}
  shortcuts={[
    {
      shortcut: MemotronAction.ACTIVATE_LINK_BOX,
      callback: () => {
        captureTopBarRef?.toggleLinkBox();
      }
    }
  ]}
/>
