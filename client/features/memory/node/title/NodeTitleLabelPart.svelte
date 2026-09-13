<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import {
    headingNodeTypes,
    type INode,
    type INodeThumb
  } from "@nucleum/features/memory/node/node.type";
  import { NodeType } from "@nucleum/schema/legacy/node-type.enum";
  import { renderMdAsHtml } from "@21n/elements/markdown/markdown.utils";

  import { cn } from "@21n/utils/ui.utils";
  import {
    AccessMode,
    ResourceAccessPoint
  } from "@nucleum/datafn/resource.type";
  import NodeAvatar from "@nucleum/features/memory/node/avatar/NodeAvatar.svelte";

  import { resolveNodeLabel } from "@nucleum/features/memory/node/node.utils";
  import NodeTitleBreadcrumbs from "@nucleum/features/memory/node/title/NodeTitleBreadcrumbs.svelte";
  import { isValidString } from "@21n/shared-utils/text.utils";
  let {
    item,
    isNodePageContext = false,
    accessPoint = ResourceAccessPoint.BROWSER,
    onClick = undefined
  }: {
    item: INode | INodeThumb;
    isNodePageContext?: boolean;
    accessPoint?: ResourceAccessPoint;
    onClick?: (() => void) | undefined;
  } = $props();
  let _label = $state<
    | string
    | {
        label: string;
        parent: {
          id?: string;
          label: string;
        };
        text?: string;
      }
    | undefined
  >(undefined);
  const dynamicLabelNodeTypes = [
    NodeType.TWEET,
    NodeType.TWITTER_PROFILE,
    NodeType.WEB_TEXT_BOOKMARK,
    NodeType.WEB_SCREENSHOT,
    NodeType.YOUTUBE_BOOKMARK,
    NodeType.KINDLE_HIGHLIGHT
  ];
  function resolveEmptyLabel() {
    //TODO - based on resource type
    return "Untitled";
  }

  function resolveLabelObject() {
    return typeof _label === "object" && _label && "parent" in _label
      ? _label
      : undefined;
  }

  function onParentClick(e: MouseEvent) {
    const labelObject = resolveLabelObject();
    if (
      !labelObject ||
      !labelObject.parent.id ||
      accessPoint === ResourceAccessPoint.SEARCH_RESULT
    )
      return;
    navigation.resourceClickHandler(e, labelObject.parent.id, {
      replaceId: accessPoint === ResourceAccessPoint.SELF ? item.id : undefined,
      defaultTo: AccessMode.POP
    });
  }

  $effect(() => {
    _label = resolveNodeLabel(item as INodeThumb);
    if (accessPoint === ResourceAccessPoint.LIBRARY) {
      console.log(
        "NodeTitleLabelPart.resolve",
        JSON.stringify({
          id: item?.id,
          contentType: item?.contentType,
          itemLabel: item?.label,
          itemText: item?.text,
          resolvedLabel: _label
        })
      );
    }
  });

  function handleRootClick() {
    onClick?.();
  }

  function handleRootKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleRootClick();
    }
  }

  function resolveTextFallback() {
    if (item.contentType !== NodeType.NODULAR_MARKDOWN) return undefined;
    if (typeof item.text !== "string") return undefined;
    const itemText = item.text;
    if (!isValidString(itemText)) return undefined;
    const firstLine = itemText
      .split("\n")
      .map((line) => line.trim())
      .find((line) => isValidString(line));
    if (!firstLine) return undefined;
    const normalized = firstLine
      .replace(/^#{1,6}\s+/, "")
      .replace(/^>\s+/, "")
      .replace(/^[-*+]\s+/, "")
      .replace(/^\d+\.\s+/, "")
      .replace(/^\[[ xX]\]\s+/, "")
      .trim();
    return isValidString(normalized) ? normalized : undefined;
  }
</script>

<div>
  {#if headingNodeTypes.includes(item.contentType) && item.mdParent}
    <NodeTitleBreadcrumbs
      id={item.id}
      mdParent={item.mdParent}
      currentLabel={item.label}
      onClick={handleRootClick}
      isThumbnailContext={true}
    />
  {/if}
  <div
    class={cn("flex gap-1 items-center truncate userdata", {
      "text-b2":
        accessPoint !== ResourceAccessPoint.TABS &&
        accessPoint !== ResourceAccessPoint.SELF,
      "text-fgs2": accessPoint === ResourceAccessPoint.MARKDOWN_EMBED,
      "text-h4 cw:text-h5 font-medium": accessPoint === ResourceAccessPoint.SELF
    })}
    role="button"
    tabindex="0"
    onclick={handleRootClick}
    onkeydown={handleRootKeyDown}
  >
    <NodeAvatar node={item} {accessPoint} />
    {#if item.labelSearch}
      <span>
        {@html renderMdAsHtml(item.labelSearch)}
      </span>
    {:else if _label}
      {#if typeof _label === "string"}
        {_label ?? "Unknown"}
      {:else if typeof _label === "object" && "parent" in _label}
        <span class="flex w-full gap-1 items-center truncate">
          <span class="truncate">
            {_label?.label}
          </span>
          <button
            class={cn("truncate flex-1 min-w-0 text-left", {
              "underline-dotted cursor-pointer hover:underline-dotted-primary":
                isNodePageContext
            })}
            onclick={onParentClick}
          >
            {resolveLabelObject()?.parent?.label}
          </button>
        </span>
      {/if}
    {:else if resolveTextFallback()}
      {resolveTextFallback()}
    {:else}
      {resolveEmptyLabel()}
    {/if}
  </div>
</div>
