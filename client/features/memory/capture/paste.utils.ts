import { requireCommandHost } from "@nucleum/stores/commands/command-host";
import { logger } from "@nucleum/client/runtime/logging/logger";
import { toasts } from "@nucleum/stores/notification.store";

import { MemotronAction } from "@nucleum/features/memory/memory-action.enum";

type ClipboardItemEntry = {
  type: string;
  getAsString: (callback: (value: string) => void) => void;
};

function createItemList(items: ClipboardItemEntry[]) {
  const list = Object.assign([], items) as unknown as ClipboardItemEntry[] & {
    item: (index: number) => ClipboardItemEntry | null;
  };
  list.item = (index: number) => list[index] ?? null;
  return list;
}

function resolveGetData(items: ClipboardItemEntry[], text?: string) {
  return (type: string) => {
    if (type === "text" || type === "text/plain") {
      return text ?? "";
    }
    const entry = items.find((item) => item.type === type);
    if (!entry) return "";
    let result = "";
    entry.getAsString((value) => {
      result = value ?? "";
    });
    return result;
  };
}

async function resolveClipboardEvent(): Promise<ClipboardEvent | null> {
  if (typeof window === "undefined" || !navigator?.clipboard) {
    return null;
  }

  const entries: ClipboardItemEntry[] = [];
  let textContent: string | undefined = undefined;
  const files: File[] = [];

  if ("read" in navigator.clipboard) {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          try {
            const blob = await item.getType(type);
            if (type.startsWith("text")) {
              const value = await blob.text();
              entries.push({
                type,
                getAsString: (callback) => callback(value)
              });
              if (!textContent && type === "text/plain") {
                textContent = value;
              }
            } else {
              const extension = type.split("/")[1] ?? "bin";
              const fileName = `clipboard-${Date.now()}.${extension}`;
              let file: File;
              if (typeof File !== "undefined") {
                try {
                  file = new File([blob], fileName, { type: blob.type });
                } catch (error) {
                  logger.warn({
                    at: "resolveClipboardEvent.newFile",
                    error,
                    fallback: true
                  });
                  file = Object.assign(new Blob([blob], { type: blob.type }), {
                    name: fileName
                  }) as File;
                }
              } else {
                file = Object.assign(new Blob([blob], { type: blob.type }), {
                  name: fileName
                }) as File;
              }
              files.push(file);
              entries.push({
                type,
                getAsString: (callback) => callback("")
              });
            }
          } catch (error) {
            logger.error({ at: "resolveClipboardEvent.getType", error });
          }
        }
      }
    } catch (error) {
      logger.error({ at: "resolveClipboardEvent.read", error });
    }
  }

  if (!textContent && "readText" in navigator.clipboard) {
    try {
      textContent = await navigator.clipboard.readText();
      if (textContent) {
        entries.push({
          type: "text/plain",
          getAsString: (callback) => callback(textContent as string)
        });
      }
    } catch (error) {
      logger.error({ at: "resolveClipboardEvent.readText", error });
    }
  }

  if (!entries.length) {
    return null;
  }

  const filesList = Object.assign([], files) as unknown as File[] & {
    item: (index: number) => File | null;
  };
  filesList.item = (index: number) => filesList[index] ?? null;

  const clipboardData = {
    items: createItemList(entries),
    files: filesList,
    getData: resolveGetData(entries, textContent)
  } as unknown as DataTransfer;

  return {
    clipboardData
  } as ClipboardEvent;
}

export async function openPasteConfirmationModalFromClipboard() {
  try {
    const event = await resolveClipboardEvent();
    if (!event) {
      toasts.error(
        "Unable to access clipboard. Try using the paste shortcut instead."
      );
      return;
    }
    requireCommandHost().runAction(MemotronAction.PASTE_CONFIRMATION, {
      componentParams: {
        event
      }
    });
  } catch (error) {
    logger.error({ at: "openPasteConfirmationModalFromClipboard", error });
    toasts.error("Unable to read clipboard contents.");
  }
}
