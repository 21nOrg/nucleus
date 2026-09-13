<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import modalEvent from "@nucleum/stores/overlays/modal.store";
  import { onMount } from "svelte";
  import { MAX_FILE_SIZE_MB } from "@nucleum/stores/files/file.constants";
  import { MemotronAction } from "@nucleum/features/memory/memory-action.enum";
  import { NodeType } from "@nucleum/schema/legacy/node-type.enum";
  import { clipboard } from "@nucleum/features/memory/capture/capture.store";
  import type { IPasteCaptureData } from "@nucleum/features/memory/capture/capture.type";
  import { resolvePasteContents } from "@nucleum/features/memory/capture/capture.utils";
  import account from "@nucleum/stores/account.store";
  import { resourceAction } from "@nucleum/datafn/resource.utils";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
  import { generateResourceId } from "@nucleum/datafn/id.utils";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";

  import ShareContentSaver from "@nucleum/features/memory/capture/ShareContentSaver.svelte";

  let { event }: { event: ClipboardEvent } = $props();

  const id = generateResourceId(Resource.capture);
  let nodeType = $state<NodeType | undefined>(undefined);
  let error = $state<string | undefined>(undefined);
  let data = $state<IPasteCaptureData | undefined>(undefined);
  let saveAsNodeFilesCount = $state(0);
  let isOffline = $state(false);

  resolveV2(event);

  onMount(async () => {
    isOffline = account.isCloudUserAndOffline();
  });

  async function resolveV2(event: ClipboardEvent) {
    if (!event) return;
    data = await resolvePasteContents(event, {
      maxFileSizeInMb: MAX_FILE_SIZE_MB
    });
    if (!data || data.error) {
      error = data?.error ?? "An error occurred";
      return;
    }
    nodeType = data.contentType;
    if (data.multipleFiles && data.multipleFiles.files?.length > 0) {
      saveAsNodeFilesCount = data.multipleFiles?.files?.filter((file) => {
        return file.contentType !== NodeType.FILE;
      }).length;
    }
  }

  function handleInsertIntoMarkdown() {
    clipboard.set({
      ...data,
      contentType: data?.contentType ?? NodeType.SIMPLE_TEXT
    });
    modalEvent.hide(MemotronAction.PASTE_CONFIRMATION);
    requireCommandHost().runAction(
      resourceAction(Resource.node, ResourceActionType.CREATE),
      {
        searchParams: {
          [AppSearchParam.CLIPBOARD]: true
        },
        componentParams: {
          captureId: id
        }
      }
    );
  }

  function handleSaved() {
    // modalEvent.hide(MemotronAction.PASTE_CONFIRMATION);
  }

  function handleOpen({ nodeId }: { nodeId: string | undefined }) {
    if (nodeId) {
      navigation.openResource(nodeId, AccessMode.POP);
    }
    modalEvent.hide(MemotronAction.PASTE_CONFIRMATION);
  }

  function handleClose() {
    modalEvent.hide(MemotronAction.PASTE_CONFIRMATION);
  }
</script>

{#if data}
  <ShareContentSaver
    {data}
    nodeType={nodeType ?? NodeType.UNKNOWN}
    {error}
    {isOffline}
    {saveAsNodeFilesCount}
    isShowInsertIntoMarkdown={true}
    onSaved={handleSaved}
    onOpen={handleOpen}
    onClose={handleClose}
    onInsertIntoMarkdown={handleInsertIntoMarkdown}
  />
{/if}
