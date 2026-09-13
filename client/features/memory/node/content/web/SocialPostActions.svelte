<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { type IButtonParams } from "@21n/elements/button/button.type";
  import ButtonGroup from "@21n/elements/button/ButtonGroup.svelte";
  import { Size } from "@21n/elements/size.enum";

  import { type INode } from "@nucleum/features/memory/node/node.type";
  import { NodeType } from "@nucleum/schema/legacy/node-type.enum";
  import { resolveContentPreview } from "@nucleum/features/memory/node/node.utils";
  import { properCase } from "@21n/shared-utils/text.utils";
  import { toasts } from "@nucleum/stores/notification.store";
  let { node }: { node: INode } = $props();
  let hasPermanentCopy = $derived(!!resolveContentPreview(node));

  function resolveOpenInButtonLabel() {
    let suffix = "";
    if (node.contentType === NodeType.TWEET) suffix = "Twitter";
    else if (
      node.contentType === NodeType.INSTAGRAM_POST ||
      node.contentType === NodeType.INSTAGRAM_REEL
    )
      suffix = "Instagram";
    else suffix = properCase(node.contentType.split("_POST")[0]);
    return `Open on ${suffix}`;
  }

  async function copyTextContent() {
    const text = resolveContentPreview(node);
    if (text) {
      await navigator.clipboard.writeText(text);
      toasts.success("Text copied to clipboard");
    }
  }

  let buttons = $derived([
    ...(hasPermanentCopy
      ? [
          {
            label: "Copy text content",
            icon: "copy",
            size: Size.sm,
            callback: async (e: MouseEvent) => {
              e.stopPropagation();
              await copyTextContent();
            }
          } as IButtonParams
        ]
      : []),
    {
      label: resolveOpenInButtonLabel(),
      icon: "weblink",
      size: Size.sm,
      callback: async () => {
        if (!node.url) return;
        navigation.openLink(node.url);
      }
    } as IButtonParams
  ]);
</script>

<ButtonGroup size={Size.xs} {buttons} isFooter={true} />
