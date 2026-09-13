<svelte:options runes={true} />

<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";
  import { accountDeletion } from "@nucleum/application/account/account-deletion";

  import Button from "@21n/elements/button/Button.svelte";
  import account from "@nucleum/stores/account.store";
  import { appStore } from "@nucleum/stores/app.store";
  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
  import { properCase } from "@21n/shared-utils/text.utils";
  import RegionSetting from "@nucleum/application/settings/account/RegionSetting.svelte";
  import InlineInfoBanner from "@21n/elements/text/InlineInfoBanner.svelte";
  import InlineErrorMessage from "@21n/elements/text/InlineErrorMessage.svelte";
  import { InfoTextType } from "@21n/elements/text/info.type";

  let region = $state("useast");
  let isBootstrapInProgress = $state(false);
  let error = $state<string | null>(null);

  const productName = $derived(properCase($appStore?.product ?? "nucleum"));
  const currentUserInfo = $derived($account?.userInfo);
  const isAlreadyBootstrapped = $derived(
    Boolean(currentUserInfo?.isBootstrapped && currentUserInfo?.region)
  );

  $effect(() => {
    if (currentUserInfo?.region) {
      region = currentUserInfo.region;
    }
  });
</script>

<div class="w-full h-full flex justify-center items-center overflow-auto">
  <div
    class="mo:w-full mo:px-4 w-[40rem] h-full flex flex-col mo:gap-10 gap-20 justify-center"
  >
    <div class="flex flex-col gap-2">
      <div class="text-xl text-fgs3 userdata">
        Hi {currentUserInfo?.nickName ?? "there"}!
      </div>
      <div class="text-b2 text-fgs3">
        Thanks for taking your time to try {productName}. One last step before
        you can start using the app.
      </div>
    </div>
    <RegionSetting
      bind:region
      isDisabled={isBootstrapInProgress || isAlreadyBootstrapped}
    />
    {#if isAlreadyBootstrapped}
      <InlineInfoBanner
        type={InfoTextType.ERROR}
        content="**Account setup is complete.** Currently, you cannot change your region once set. If you wish to change your region, please chat with us for assistance or delete your account and create a new one."
        action={{ label: "Chat with us", action: "chat" }}
      />
    {/if}
    <InlineErrorMessage bind:error />
    <div class="flex w-full justify-center">
      {#if isAlreadyBootstrapped}
        <div class="flex gap-2 mo:flex-col">
          <Button
            label="Delete and create new account"
            type={ButtonVariant.DANGER}
            style={ButtonStyle.OUTLINED}
            onclick={() => {
              accountDeletion.delete();
            }}
          />
          <Button
            label="Go to home"
            type={ButtonVariant.PRIMARY}
            onclick={() => {
              navigation.gotoPath("/");
            }}
          />
        </div>
      {:else}
        <Button
          label="Complete setup"
          isLoading={isBootstrapInProgress}
          type={ButtonVariant.PRIMARY}
          icon="rocket"
          onclick={async () => {
            try {
              isBootstrapInProgress = true;
              const result = await account.bootstrap(region);
              if (!result) {
                error = "Something went wrong. Please try again later.";
                return;
              }
            } finally {
              isBootstrapInProgress = false;
            }
          }}
        />
      {/if}
    </div>
  </div>
</div>
