<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import MediaContentResolver from "@nucleum/features/memory/node/content/MediaContentResolver.svelte";
  import {
    mediaNodeTypeList,
    type INode,
    type INodeThumb
  } from "@nucleum/features/memory/node/node.type";
  import { NodeType } from "@nucleum/schema/legacy/node-type.enum";
  import { getContext, untrack } from "svelte";
  import { get } from "svelte/store";
  import type { IEmbedBlockBody } from "@nucleum/features/memory/markdown/md.type";
  import EmbedContentPlaceholder from "@nucleum/features/memory/markdown/embed/EmbedContentPlaceholder.svelte";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  import {
    AccessMode,
    ResourceAccessPoint
  } from "@nucleum/datafn/resource.type";
  import YoutubeVideoPreview from "@nucleum/features/memory/node/content/web/YoutubeVideoPreview.svelte";
  import { cn } from "@21n/utils/ui.utils";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import Collection from "@nucleum/features/collections/Collection.svelte";
  import { determineResourceType } from "@nucleum/datafn/resource.utils";
  import { resizable } from "@nucleum/actions/resize.action";

  import NodeTitleLabelPart from "@nucleum/features/memory/node/title/NodeTitleLabelPart.svelte";
  import Icon from "@21n/elements/Icon.svelte";
  import { Size } from "@21n/elements/size.enum";
  import type { MdStoreType } from "@nucleum/features/memory/markdown/markdown.store";
  import TextInput from "@21n/elements/input/TextInput.svelte";
  import { toasts } from "@nucleum/stores/notification.store";
  import { formatBytes } from "@21n/shared-utils/text.utils";
  import Button from "@21n/elements/button/Button.svelte";
  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
  import { fileStore } from "@nucleum/stores/files/file.store";
  import type { IFile } from "@nucleum/stores/files/file.type";
  import { ErrorMessage } from "@nucleum/stores/notifications/error.enum";
  import {
    fetchYouTubeMetadata,
    resolveWebpageLabel,
    sanitizeAndResolve
  } from "@nucleum/features/memory/node/url.utils";
  import { debouncer } from "@21n/utils/utils";
  import context from "@nucleum/stores/context.store";
  import { Embed } from "@nucleum/client/runtime/context.type";
  import view from "@nucleum/stores/view.store";
  import Task from "@nucleum/features/focus/tasks/Task.svelte";
  import { Context } from "@nucleum/stores/appStore.type";
  import { datafn } from "@nucleum/datafn/datafn.store";
  import { toSvelteStore } from "@datafn/svelte";
  import { generateResourceId } from "@nucleum/datafn/id.utils";
  const nodeContext = getContext<any>(Context.NODE);
  const contentContext = getContext<any>(Context.CONTENT);
  let {
    id,
    body,
    mdStore,
    isHovering = false,
    onDelete = undefined,
    onUpdate = undefined
  }: {
    id: IRecordId;
    body: IEmbedBlockBody;
    mdStore: MdStoreType;
    isHovering?: boolean;
    onDelete?: ((event?: CustomEvent<void>) => void) | undefined;
    onUpdate?:
      ((event: CustomEvent<Partial<IEmbedBlockBody>>) => void) | undefined;
  } = $props();
  const embedResourceType = $derived(
    body?.id ? determineResourceType(body.id) : undefined
  );

  let linkInputValue = $state("");
  let _mediaBlock = $state<INode | undefined>(undefined);
  let refreshId = $state(new Date().getTime());
  let _mediaBlockFile = $state<IFile | undefined>(undefined);
  let height = $state(body?.height ?? 300);
  let isLoading = $state(true);
  let isEditingTitle = $state(false);
  let titleInputValue = $state("");
  let titleInputRef: TextInput | undefined;

  const titleNotRequiredTypes = [NodeType.KINDLE_BOOK];
  const resizableTypes = [
    NodeType.IMAGE,
    NodeType.PDF,
    NodeType.WEB_PAGE,
    NodeType.WEB_SCREENSHOT,
    NodeType.YOUTUBE_VIDEO,
    NodeType.YOUTUBE_SHORT,
    NodeType.YOUTUBE_BOOKMARK,
    NodeType.GIST
  ];

  const isResizable = $derived(
    (!$mdStore.params?.isReadOnly &&
      _mediaBlock?.contentType &&
      resizableTypes.includes(_mediaBlock?.contentType) &&
      !body?.isHidePreview) ??
      false
  );

  const isShowTitle = $derived(
    _mediaBlock?.contentType &&
      !titleNotRequiredTypes.includes(_mediaBlock?.contentType)
  );

  const isShowPreview = $derived(
    _mediaBlock?.contentType &&
      !body?.isHidePreview &&
      _mediaBlock?.contentType !== NodeType.FILE
  );

  function onSelectFromLibrary(event: CustomEvent) {
    logger.debug({ at: "EmbedContent onSelectFromLibrary", event });
    if (!event.detail.id) return;
    const resource = determineResourceType(event.detail.id);
    if (resource === Resource.node) {
      _mediaBlock = event.detail;
      dispatchUpdateEvent({
        id: event.detail.id,
        subType: event.detail.contentType
      });
      contentContext.publish("mention", {
        location: id,
        item: event.detail
      });
    } else if (resource === Resource.collection) {
      dispatchUpdateEvent({
        id: event.detail.id,
        subType: NodeType.COLLECTION_AS_EMBED
      });
    } else if (resource === Resource.task) {
      dispatchUpdateEvent({
        id: event.detail.id,
        subType: NodeType.TASK_AS_EMBED
      });
    }
  }

  function dispatchUpdateEvent(body: Partial<IEmbedBlockBody>) {
    const updateEvent = new CustomEvent<Partial<IEmbedBlockBody>>("update", {
      detail: body
    });
    onUpdate?.(updateEvent);
  }
  const debouncedDispatchUpdateEvent = debouncer(dispatchUpdateEvent, 500);

  function emitDelete() {
    const deleteEvent = new CustomEvent<void>("delete");
    onDelete?.(deleteEvent);
  }

  async function assignNodeMediaContent(id: IRecordId) {
    const result = (await datafn.node.query({
      select: ["*", "parent.*", "file.*"],
      filters: { id },
      limit: 1,
      metadata: {
        includeTrashed: true,
        includeArchived: true
      }
    } as any)) as { data?: INode[] };
    const node = result.data?.[0];
    if (node) {
      _mediaBlock = node;
      _mediaBlockFile = node.file as unknown as IFile;
      return;
    }
    _mediaBlock = undefined;
    _mediaBlockFile = undefined;
  }

  $effect(() => {
    const nextHeight = body?.height ?? 300;
    if (height !== nextHeight) height = nextHeight;
  });

  $effect(() => {
    const bodyId = body?.id;

    if (!bodyId || embedResourceType !== Resource.node) {
      isLoading = false;
      return;
    }

    let cancelled = false;
    isLoading = true;

    void assignNodeMediaContent(bodyId)
      .catch((e) => {
        logger.error({ at: "EmbedContent assignNodeMediaContent", e });
      })
      .finally(() => {
        if (!cancelled) isLoading = false;
      });

    return () => {
      cancelled = true;
    };
  });

  const bodyStore = $derived.by(() => {
    const bodyId = body?.id;
    if (!bodyId || embedResourceType !== Resource.node) return undefined;
    return toSvelteStore<Partial<INode>[]>(
      datafn.node.signal({
        filters: { id: bodyId },
        limit: 1,
        metadata: {
          includeTrashed: true,
          includeArchived: true
        }
      }),
      { initialData: [] }
    );
  });

  $effect(() => {
    if (!bodyStore) return;
    if (get(bodyStore).data[0]) {
      untrack(() => {
        void onNodeChange();
      });
    }
  });

  async function onLinkInput() {
    try {
      isLoading = true;
      const sanitized = sanitizeAndResolve(linkInputValue);
      if (typeof sanitized === "string") {
        toasts.error("Invalid URL");
        return;
      }

      if (body?.subType && body.subType !== NodeType.UNKNOWN) {
        if (sanitized.contentType !== body.subType) {
          toasts.error(`Invalid URL. Expected ${body.subType} URL`);
          return;
        }
        dispatchUpdateEvent({ url: sanitized.url });
        return;
      }
      const result = await createEmbeddedWebNode(sanitized);
      if (!result || !("id" in result)) return;
      dispatchUpdateEvent({ id: result.id, subType: sanitized.contentType });
      _mediaBlock = result as unknown as INode;
    } catch (e) {
      logger.error({ at: "EmbedContent onLinkInput", e });
      toasts.error(ErrorMessage.DEFAULT);
    } finally {
      isLoading = false;
    }
  }

  async function createEmbeddedWebNode(sanitized: {
    contentType: NodeType;
    url: string;
  }) {
    let label = resolveWebpageLabel(sanitized.url);
    let metadata: Record<string, unknown> | undefined = undefined;
    if (isYoutubeEmbedSubType(sanitized.contentType)) {
      const youtubeMetadata = await fetchYouTubeMetadata(sanitized.url);
      if (youtubeMetadata) {
        label = youtubeMetadata.title;
        metadata = {
          authorName: youtubeMetadata.author_name,
          authorUrl: youtubeMetadata.author_url,
          thumbnailUrl: youtubeMetadata.thumbnail_url
        };
      }
    }
    const node = {
      id: generateResourceId(Resource.node),
      metaType: "",
      contentType: sanitized.contentType,
      label,
      url: sanitized.url,
      creationContext: nodeContext?.id,
      body: {
        hash: "",
        description: ""
      },
      metadata
    } as INode;
    await datafn.node.mutate({
      operation: "insert",
      id: node.id,
      record: node,
      context: ResourceAccessPoint.MARKDOWN_EMBED
    });
    return node;
  }

  function onResize(e: any) {
    height = e.height;
    debouncedDispatchUpdateEvent({ height });
  }

  function resolveEmbedTarget(target: EventTarget | null) {
    return target as HTMLElement | null;
  }

  function resolveNodeThumb(node: INode) {
    return node as unknown as INodeThumb;
  }

  function isYoutubeEmbedSubType(subType: NodeType | undefined) {
    return (
      subType === NodeType.YOUTUBE_VIDEO || subType === NodeType.YOUTUBE_SHORT
    );
  }

  function onEditTitle(e: MouseEvent) {
    if ($view.isConstrainedWidth) {
      if (body.id) navigation.openResource(body.id, AccessMode.POP);
      return;
    }
    e.stopPropagation();
    isEditingTitle = true;
    titleInputValue = _mediaBlock?.label ?? "";
    setTimeout(() => {
      titleInputRef?.focus();
    }, 100);
  }

  async function onNodeChange() {
    if (body.id) await assignNodeMediaContent(body.id);
    refreshId = new Date().getTime();
  }
</script>

{#if body.id && _mediaBlock && !isLoading}
  {#key refreshId}
    <button
      class={cn("flex flex-col w-full", {
        "pt-4": isShowTitle && isShowPreview,
        "py-2": !isShowTitle,
        "my-4": $view.isConstrainedWidth
      })}
      style={isResizable
        ? `min-height: ${height}px; height: ${height}px; max-height: ${height}px;`
        : ""}
      use:resizable={{
        enabled: !$context.isTouchDevice && isResizable && !isEditingTitle,
        minHeight: 300,
        maxHeight: 1600,
        edges: ["bottom"],
        onResize: onResize
      }}
      onclick={(e) => {
        if (resolveEmbedTarget(e.target)?.classList.contains("resizer")) return;
        if (_mediaBlock?.contentType === NodeType.FILE) return;
        if (body.id) navigation.openResource(body.id, AccessMode.POP);
      }}
    >
      {#if isShowPreview}
        <div
          class={cn("flex w-full", {
            // "min-h-[40rem] h-[40rem]": _mediaBlock.contentType === NodeType.PDF,
            "flex-grow justify-center": isResizable,
            "h-auto max-h-[20rem]":
              !isResizable &&
              ![NodeType.TWEET].includes(_mediaBlock?.contentType),
            "overflow-auto": _mediaBlock?.contentType === NodeType.GIST
          })}
        >
          <MediaContentResolver
            node={_mediaBlock}
            accessPoint={ResourceAccessPoint.MARKDOWN_EMBED}
          />
        </div>
      {/if}
      {#if isShowTitle}
        {#if isEditingTitle && !$mdStore.params?.isReadOnly}
          <button
            class="flex justify-center items-center w-full h-16 rounded-md"
            onclick={(event) => {
              event.stopPropagation();
            }}
          >
            <TextInput
              bind:value={titleInputValue}
              bind:this={titleInputRef}
              parentBackgroundIndex={2}
              placeholder="Title"
              width="w-full"
              size={Size.sm}
              onSave={() => {
                if (_mediaBlock) {
                  _mediaBlock.label = titleInputValue;
                  datafn.node.mutate({
                    operation: "merge",
                    id: _mediaBlock.id,
                    record: { label: titleInputValue }
                  });
                }
                setTimeout(() => {
                  isEditingTitle = false;
                }, 100);
              }}
              onCancel={() => {
                setTimeout(() => {
                  titleInputValue = _mediaBlock?.label ?? "";
                  isEditingTitle = false;
                }, 100);
              }}
              isShowSaveControl={true}
            />
          </button>
        {:else}
          <button
            class={cn(
              "flex w-full justify-between items-center gap-2 rounded-md",
              {
                "h-16 px-3": !isShowPreview,
                "bg-bgs2":
                  !isShowPreview &&
                  (!isHovering || $mdStore.params?.isReadOnly),
                "h-20": isShowPreview
              }
            )}
            onclick={onEditTitle}
          >
            <div
              class={cn("flex w-96 mo:w-full", {
                "flex-col gap-1": _mediaBlock?.url,
                "gap-2 items-center": _mediaBlockFile
              })}
            >
              <NodeTitleLabelPart
                item={resolveNodeThumb(_mediaBlock)}
                accessPoint={ResourceAccessPoint.MARKDOWN_EMBED}
              />
              {#if !isShowPreview && _mediaBlockFile}
                <span
                  class="text-left text-b4 text-fgs4 whitespace-nowrap shrink-0"
                >
                  {_mediaBlockFile.size
                    ? formatBytes(_mediaBlockFile.size)
                    : "Unknown size"}
                </span>
              {:else if !isShowPreview && _mediaBlock?.url}
                <button
                  class="text-xs text-left text-fgs4 whitespace-nowrap shrink-0 hover:underline"
                  onclick={(e) => {
                    if (_mediaBlock?.url) {
                      navigation.openLink(_mediaBlock.url);
                    }
                    e.stopPropagation();
                  }}
                >
                  {_mediaBlock.url.replace(/^https?:\/\//, "").split("?")[0]}
                </button>
              {/if}
            </div>
            {#if isHovering}
              <div class="flex gap-2 items-center shrink-0">
                {#if !$mdStore.params?.isReadOnly}
                  <Button
                    icon="edit"
                    tooltip="Edit title"
                    size={Size.sm}
                    style={ButtonStyle.OUTLINED}
                    onclick={onEditTitle}
                  />
                {/if}
                {#if _mediaBlock?.contentType !== NodeType.FILE}
                  <Button
                    icon="circle"
                    tooltip="Go to node"
                    size={Size.sm}
                    style={ButtonStyle.OUTLINED}
                    onclick={() => {
                      if (body.id)
                        navigation.openResource(body.id, AccessMode.POP);
                    }}
                  />
                {/if}
                {#if mediaNodeTypeList.includes(_mediaBlock?.contentType)}
                  <Button
                    icon="download"
                    tooltip="Download"
                    size={Size.sm}
                    style={ButtonStyle.OUTLINED}
                    onclick={(e) => {
                      if (_mediaBlock?.file) {
                        fileStore.download(_mediaBlock.file);
                      }
                      e.stopPropagation();
                    }}
                  />
                {/if}
                {#if _mediaBlock?.url}
                  <Button
                    icon="weblink"
                    tooltip="Go to external link"
                    size={Size.sm}
                    style={ButtonStyle.OUTLINED}
                    onclick={(e) => {
                      if (_mediaBlock?.url) {
                        navigation.openLink(_mediaBlock.url);
                      }
                      e.stopPropagation();
                    }}
                  />
                {/if}
                {#if !$mdStore.params?.isReadOnly}
                  <Button
                    icon="trash"
                    tooltip="Delete"
                    size={Size.sm}
                    type={ButtonVariant.DANGER}
                    style={ButtonStyle.OUTLINED}
                    onclick={emitDelete}
                  />
                {/if}
              </div>
            {/if}
          </button>
        {/if}
      {/if}
    </button>
  {/key}
{:else if body?.url && isYoutubeEmbedSubType(body?.subType)}
  <YoutubeVideoPreview url={body.url} />
{:else if body?.subType === NodeType.COLLECTION_AS_EMBED && body?.id}
  <div class="h-96 w-[90vw] py-4 max-w-full overflow-x-auto">
    <Collection
      id={body.id}
      accessPoint={ResourceAccessPoint.MARKDOWN_EMBED}
      parentBgIndex={$context.embed === Embed.HANDSET ? 2 : 1}
    />
  </div>
{:else if body?.subType === NodeType.TASK_AS_EMBED && body?.id}
  {#key body.id.toString()}
    <div class="h-fit min-h-20 w-full py-4 max-w-full overflow-x-auto">
      <Task id={body.id} accessPoint={ResourceAccessPoint.MARKDOWN_EMBED} />
    </div>
  {/key}
{:else if isLoading}
  <div class="flex items-center justify-center w-full h-80 bg-bgs2">
    <Icon icon="svg-spinners:3-dots-fade" size={Size.xl} />
  </div>
{:else}
  <EmbedContentPlaceholder
    subType={body?.subType && body.subType !== NodeType.UNKNOWN
      ? body.subType
      : undefined}
    bind:linkInputValue
    onSelect={onSelectFromLibrary}
    {onLinkInput}
  />
{/if}
