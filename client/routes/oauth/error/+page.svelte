<script>
  import { navigation } from "@21n/layout/navigation/navigation";

  import { page } from "$app/stores";
  import PageError from "@nucleum/application/error/PageError.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import { ButtonVariant } from "@21n/elements/button/button.type";

  function resolveErrorParam() {
    return $page?.url?.searchParams?.get("error") ?? undefined;
  }

  function resolveActions() {
    if (!resolveErrorParam()?.includes("beta")) {
      return [];
    }
    return [
      {
        label: "Request Early Access",
        variant: ButtonVariant.PRIMARY,
        callback: async () => {
          navigation.openLink(
            $appStore?.appData?.urls?.earlyAccess ?? "https://21n.org"
          );
        }
      }
    ];
  }
</script>

<PageError message={resolveErrorParam()} actions={resolveActions()} />
