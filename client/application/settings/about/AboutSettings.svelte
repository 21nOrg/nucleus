<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import Button from "@21n/elements/button/Button.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import { Size } from "@21n/elements/size.enum";
  import A21nLogo from "@21n/branding/A21nLogo.svelte";
  import { ButtonVariant } from "@21n/elements/button/button.type";
  let size = Size.md;
</script>

<div class="flex flex-col gap-8 py-2 text-b2 text-left">
  {#if $appStore.appData.about}
    <div>
      {@html $appStore.appData.about}
    </div>
  {:else}
    <div class="flex flex-col gap-8 items-center">
      <div class="flex flex-col gap-7 w-full max-w-3xl">
        <div class="bg-bgs2 rounded-[20px] p-7 flex flex-col gap-4 w-full">
          <div class="">
            We are a lean independent team based in Hyderabad, India. We are on
            a mission to build impressive products with triple bottom line as
            our core.
          </div>
          <div>
            <div
              class="flex items-center gap-1 text-fgs2 text-b3 w-full justify-start"
            >
              <span class="-mb-[1.5px]"> - Team </span>
              <A21nLogo size={Size.xs} fill="fgs2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
  <div class="flex w-full justify-center">
    <div class="flex portrait:flex-col gap-4">
      <Button
        label="Join us on discord"
        {size}
        type={ButtonVariant.PRIMARY}
        icon="discord"
        onclick={() => {
          navigation.openLink($appStore.appData?.urls?.discord);
        }}
      />
      <Button
        label="Read our white paper"
        {size}
        icon="weblink"
        onclick={() => {
          navigation.openLink($appStore.appData?.urls?.soft);
        }}
      />
    </div>
  </div>
</div>
