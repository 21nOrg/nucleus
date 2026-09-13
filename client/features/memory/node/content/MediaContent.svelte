<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { webNodeTypeList } from "@nucleum/features/memory/node/node.type";
  import { NodeType } from "@nucleum/schema/legacy/node-type.enum";
  import { ResourcePanelType } from "@nucleum/stores/resources/resource-panel.type";
  import { type IActiveNodeStore } from "@nucleum/features/memory/node/node.store";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import { cn } from "@21n/utils/ui.utils";
  import MediaNodeRightPane from "@nucleum/features/memory/node/rightPanel/MediaNodeRightPane.svelte";
  import { setContext } from "svelte";
  import view from "@nucleum/stores/view.store";
  import MediaContentResolver from "@nucleum/features/memory/node/content/MediaContentResolver.svelte";

  import { isRecordId } from "@nucleum/datafn/resource.utils";
  import context from "@nucleum/stores/context.store";
  import { OperatingSystem } from "@nucleum/client/runtime/context.type";
  import { Context } from "@nucleum/stores/appStore.type";
  let {
    node,
    isConstrainedWidth = false
  }: {
    node: IActiveNodeStore;
    isConstrainedWidth?: boolean;
  } = $props();
  let renderingDetails = $state<any>(undefined);
  let contentRef = $state<MediaContentResolver | undefined>(undefined);

  function contextEventListener(event: string, data: any) {
    if (event === "pdf-trace-click" || event === "yt-trace-click") {
      if ($view.isPortrait && isRecordId(data.id)) {
        navigation.openResource(data.id, AccessMode.POP);
      } else {
        contentRef?.onTraceClick(data);
      }
    }
  }
  const contentContext = {
    publish: contextEventListener
  };
  setContext(Context.CONTENT, contentContext);

  function onAnnotation(annotations: any[]) {
    if ($node.contentType === NodeType.PDF && annotations) {
      node.update((current) => ({
        ...current,
        pdfAnnotations: annotations
      }));
    }
  }

  function onConfigUpdate(detail: any) {
    if ($node.contentType === NodeType.PDF && detail?.config)
      node.modify({
        config: {
          ...($node.config ?? {}),
          ...detail.config
        }
      });
  }
</script>

<div class="flex w-full h-full cw:mb-8 tp:otop:pt-12">
  {#if !(isConstrainedWidth && $node.panel && $node.panel !== ResourcePanelType.DEFAULT && $node.panel !== ResourcePanelType.NONE)}
    <main
      class={cn("relative flex justify-center min-w-96 flex-1", {
        "h-full": $node.accessMode === AccessMode.FULL,
        "border-r border-brs2":
          $node.panel ||
          (webNodeTypeList.includes($node?.contentType) && !isConstrainedWidth),
        grow:
          $node.accessMode === AccessMode.POP ||
          $node.accessMode === AccessMode.INLINE,
        "mt-16":
          $context.isEmbed &&
          $context.os === OperatingSystem.IOS &&
          $node.contentType === NodeType.VIDEO,
        "mb-16": $node.panel === ResourcePanelType.CONTENT
      })}
    >
      <MediaContentResolver
        node={$node}
        bind:this={contentRef}
        bind:renderingDetails
        {onAnnotation}
        {onConfigUpdate}
      />
    </main>
  {/if}
  {#if (!isConstrainedWidth || (isConstrainedWidth && $node.panel !== ResourcePanelType.DEFAULT)) && $node.panel !== ResourcePanelType.CONTENT}
    <MediaNodeRightPane {node} {renderingDetails} {isConstrainedWidth} />
  {/if}
</div>
