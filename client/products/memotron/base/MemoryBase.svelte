<svelte:options runes={true} />

<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { onMount } from "svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import { MemotronAction } from "@nucleum/features/memory/memory-action.enum";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import { logger } from "@nucleum/client/runtime/logging/logger";

  function handlePaste(event: ClipboardEvent) {
    try {
      const target = event.target as HTMLElement;
      if (
        !$appStore.isDnDPageActive &&
        target.nodeName !== "INPUT" &&
        target.nodeName !== "TEXTAREA" &&
        !target?.classList?.contains("text-input") &&
        !target?.classList?.contains("inline-markdown")
      ) {
        requireCommandHost().runAction(MemotronAction.PASTE_CONFIRMATION, {
          componentParams: {
            event
          }
        });
        event.preventDefault();
      }
    } catch (error) {
      logger.error(error);
    }
  }

  function handleDragEnter(event: DragEvent) {
    if (
      !event.relatedTarget &&
      !$appStore.isDnDPageActive &&
      event.dataTransfer?.effectAllowed !== "move"
    ) {
      requireCommandHost().runAction(MemotronAction.CAPTURE_DND);
    }
  }

  function handleDragLeave(event: DragEvent) {
    if (
      !event.relatedTarget &&
      !$appStore.isDnDPageActive &&
      !window.location.pathname.includes("/tab")
    ) {
      navigation.closeResource({
        id: MemotronAction.CAPTURE_DND,
        accessMode: AccessMode.POP
      });
    }
  }

  onMount(() => {
    document.addEventListener("dragenter", handleDragEnter);
    document.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("dragenter", handleDragEnter);
      document.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("paste", handlePaste);
    };
  });
</script>
