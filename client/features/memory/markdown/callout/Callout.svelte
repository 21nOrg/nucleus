<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { popover } from "@nucleum/actions/popover.action";
  import Avatar from "@21n/elements/avatarPicker/Avatar.svelte";
  import CustomColorPropagator from "@21n/elements/style/CustomColorPropagator.svelte";
  import { markdownSettings } from "@nucleum/features/memory/markdown/markdown.settings";
  import type { MdStoreType } from "@nucleum/features/memory/markdown/markdown.store";
  import type {
    ICalloutBody,
    ICalloutSetting
  } from "@nucleum/features/memory/markdown/md.type";
  import TextContent from "@nucleum/features/memory/markdown/content/TextContent.svelte";
  import CalloutSelector from "@nucleum/features/memory/markdown/callout/CalloutSelector.svelte";
  import { MemotronAction } from "@nucleum/features/memory/memory-action.enum";

  import { cn } from "@21n/utils/ui.utils";

  import { NodeType } from "@nucleum/schema/legacy/node-type.enum";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";

  let {
    id,
    body,
    mdStore,
    isHovering = false,
    onUpdate = undefined
  }: {
    id: IRecordId;
    body: ICalloutBody;
    mdStore: MdStoreType;
    isHovering?: boolean;
    onUpdate?:
      | ((
          event: CustomEvent<{ callout?: ICalloutSetting; text?: string }>
        ) => void)
      | undefined;
  } = $props();
  let _callout = $state<ICalloutSetting>(resolveCallout());
  let ref = $state<HTMLElement>();

  function resolveCallout(): ICalloutSetting {
    if (body.callout) {
      const currentCallout = body.callout;
      const calloutFromSettings = $markdownSettings.callout.find(
        (x) => x.id === currentCallout.id
      );
      return calloutFromSettings ?? currentCallout;
    } else {
      return $markdownSettings.callout[0];
    }
  }

  function resolveCalloutPopoverParams() {
    return {
      content: CalloutSelector,
      componentProps: {
        selected: _callout,
        onSelect: (callout: ICalloutSetting) => {
          _callout = callout;
          saveCalloutSetting(callout);
          ref?.dispatchEvent(new CustomEvent("hide"));
        },
        onEdit: () => {
          ref?.dispatchEvent(new CustomEvent("hide"));
          requireCommandHost().runAction(MemotronAction.CALLOUT_SETTINGS);
        }
      }
    };
  }

  function saveCalloutSetting(callout: ICalloutSetting) {
    onUpdate?.(
      new CustomEvent("update", {
        detail: { callout }
      })
    );
  }

  function handleUpdate(e: CustomEvent<string>) {
    onUpdate?.(
      new CustomEvent("update", {
        detail: { text: e.detail }
      })
    );
  }
</script>

<CustomColorPropagator
  color={_callout.color}
  class="flex gap-3 items-start bg-ccs5 border border-ccs4 rounded-md px-2 py-1 text-ccs1"
>
  {#if $mdStore.params?.isReadOnly}
    <div
      class={cn(
        "flex flex-col justify-center items-center px-2 border rounded-md h-10",
        {
          "border-ccs3": isHovering && !$mdStore.params?.isReadOnly,
          "border-transparent": !isHovering || $mdStore.params?.isReadOnly
        }
      )}
      bind:this={ref}
    >
      <Avatar avatar={_callout.avatar} />
    </div>
  {:else}
    <div
      class={cn(
        "flex flex-col justify-center items-center px-2 border rounded-md h-10",
        {
          "border-ccs3": isHovering && !$mdStore.params?.isReadOnly,
          "border-transparent": !isHovering || $mdStore.params?.isReadOnly
        }
      )}
      bind:this={ref}
      use:popover={resolveCalloutPopoverParams()}
    >
      <Avatar avatar={_callout.avatar} />
    </div>
  {/if}
  <div class="w-full">
    <TextContent
      bind:text={body.text}
      onUpdate={handleUpdate}
      {id}
      contentType={NodeType.CALLOUT}
      {mdStore}
    />
  </div>
</CustomColorPropagator>
