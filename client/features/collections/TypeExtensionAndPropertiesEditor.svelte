<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { Size } from "@21n/elements/size.enum";
  import { Orientation } from "@21n/elements/direction.enum";
  import FormControlLabel from "@21n/elements/text/formLabel/FormControlLabel.svelte";
  import { propertyEditorStore } from "@nucleum/features/collections/properties/property.store";
  import Icon from "@21n/elements/Icon.svelte";
  import SwitchInput from "@21n/elements/toggle/SwitchInput.svelte";
  import { type IActiveCollectionStore } from "./collection.store";
  import { resourceAction } from "@nucleum/datafn/resource.utils";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
  let {
    isCaptureShortcutEnabled = $bindable(false),
    collection = undefined,
    resource = undefined,
    onShortcutChange = undefined
  }: {
    isCaptureShortcutEnabled?: boolean;
    collection?: IActiveCollectionStore | undefined;
    resource?: Resource | undefined;
    onShortcutChange?: ((event: CustomEvent<any>) => void) | undefined;
  } = $props();
  const formLabelConfig = {
    orientation: Orientation.Vertical
  };

  function onCaptureShortcutChange(e: CustomEvent) {
    onShortcutChange?.(e);
  }
</script>

<div class="flex flex-col items-start w-full gap-2">
  <FormControlLabel props={{ label: "Properties" }} />
  <button
    class="flex justify-center items-center w-full border border-brs3 rounded-md h-11 text-base"
    onclick={() => {
      requireCommandHost().runAction(
        resourceAction(Resource.property, ResourceActionType.EDIT),
        {
          componentParams: {
            id: collection?.id
          }
        }
      );
    }}
  >
    <span class="flex gap-2 text-fgs2 text-b2">
      <Icon
        icon={$propertyEditorStore.properties.length > 0 ? "edit" : "plus"}
        size={Size.sm}
      />
      {$propertyEditorStore.properties.length > 0
        ? `Edit properties (${$propertyEditorStore.properties.length})`
        : "Add properties"}
    </span>
  </button>
</div>
{#if resource === Resource.node}
  <SwitchInput
    label={{
      ...formLabelConfig,
      label: "Add to capture shortcuts",
      orientation: Orientation.Horizontal,
      tooltip: {
        body: "Enabling this will create a shortcut on capture page to seamlessly capture a new node entry and add it to the collection.",
        actionText: "Learn more",
        action: "/kb/type-collections"
      }
    }}
    bind:checked={isCaptureShortcutEnabled}
    isExpanded={true}
    onChange={onCaptureShortcutChange}
  />
{/if}
