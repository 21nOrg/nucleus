<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import Icon from "@21n/elements/Icon.svelte";
  import account from "@nucleum/stores/account.store";
  import { UserDataMode } from "@nucleum/client/runtime/account/account.type";
  import { Size } from "@21n/elements/size.enum";
  import { Action } from "@nucleum/client/config/action.enum";

  import ModalFooter from "@21n/elements/modal/ModalFooter.svelte";
  import { Orientation } from "@21n/elements/direction.enum";
  import context from "@nucleum/stores/context.store";
  import { ButtonStyle } from "@21n/elements/button/button.type";
</script>

<div class="flex flex-col justify-between gap-4 h-full w-full">
  <div class="flex flex-col gap-4 w-full p-4">
    <div class="flex flex-col gap-2 items-center">
      <Icon icon="offline" size={Size.xxl} />
      <h1 class="text-h4">You seem to be offline</h1>
    </div>
    <p class="text-fgs2 text-b2 text-center">
      {#if !$context.isEmbed && $account.dataMode === UserDataMode.LOCAL}
        You are currently using offline-mode on a browser. Kindly install and
        use Desktop/mobile app to avoid data loss.
      {:else if $account.dataMode !== UserDataMode.LOCAL}
        Changes made on this device while offline will be synced when you are
        back online.
      {:else}
        You are using offline-mode of the app. Changes will be lost if you
        delete the app.
      {/if}
    </p>
  </div>

  {#if !$context.isEmbed && $account.dataMode === UserDataMode.LOCAL}
    <ModalFooter
      orientation={Orientation.Vertical}
      action={Action.OFFLINE_STATUS}
      isHideSecondaryShortcut={true}
      primaryAction={{
        label: "See all downloads",
        icon: "weblink-two",
        callback: async () => {
          requireCommandHost().runAction("downloads");
          return true;
        }
      }}
      secondaryAction={{
        label: "Sign up as cloud user",
        icon: "proceed",
        callback: async () => {
          account.signOut({ isPreventDapIdClear: true });
          return true;
        }
      }}
    />
  {:else}
    <ModalFooter
      action={Action.OFFLINE_STATUS}
      primaryAction={{
        label: "I understand",
        style: ButtonStyle.OUTLINED
      }}
    />
  {/if}
</div>
