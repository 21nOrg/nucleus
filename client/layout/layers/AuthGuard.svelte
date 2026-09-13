<svelte:options runes={true} />

<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import type { Snippet } from "svelte";
  import { page } from "$app/stores";
  import { ClientStorageKey } from "@nucleum/persistence/persistence.type";
  import { clientStorage } from "@nucleum/persistence/persistence.utils";
  import account, {
    resolveStoredUserInformation
  } from "@nucleum/stores/account.store";
  import { appStore } from "@nucleum/stores/app.store";
  import context from "@nucleum/stores/context.store";
  import {
    UserDataMode,
    UserSessionType
  } from "@nucleum/client/runtime/account/account.type";
  import { Product } from "@nucleum/client/config/product.type";
  import { PlanType } from "@nucleum/schema/account/subscription";
  import { postTokenToExtension } from "@nucleum/client/runtime/embed/embed.utils";
  import { onMount } from "svelte";
  import {
    resolveAuthSession,
    shouldUseAuthFnBearerSession
  } from "@nucleum/client/runtime/account/auth";
  import { logger } from "@nucleum/client/runtime/logging/logger";

  let { children }: { children?: Snippet<[boolean]> } = $props();
  let isLoggedIn = $state(false);

  onMount(async () => {
    if (
      !$context.isSheet &&
      $context.isEmbed
      // && $context.protocol.includes(import.meta.env?.VITE_CUSTOM_PROTOCOL)
    ) {
      await parseEmbedToken();
    }
    const result = await performLoginStatusCheck();
    if (
      result &&
      $account.dataMode === UserDataMode.CLOUD &&
      !$account.userInfo?.isBootstrapped
    ) {
      account.update((current) => ({
        ...current,
        sessionType: UserSessionType.NEW
      }));
      navigation.gotoPath("/bootstrap");
      return;
    }
    if (result) {
      const isLoginFromExtension = await clientStorage.getForSession(
        ClientStorageKey.IS_EXTENSION_LOGIN
      );
      if (isLoginFromExtension) {
        clientStorage.removeForSession(ClientStorageKey.IS_EXTENSION_LOGIN);
        const userInfo = await clientStorage.get(ClientStorageKey.USER_INFO);
        const token = shouldUseAuthFnBearerSession()
          ? await clientStorage.get(ClientStorageKey.AUTHFN_TOKEN)
          : undefined;
        postTokenToExtension({ token, userInfo });
        navigation.gotoPath("/ext/login");
        return;
      }
    }
    isLoggedIn = result;
    console.log({ isLoggedIn });
  });

  async function parseEmbedToken() {
    const token = $page.url?.searchParams?.get("token");
    if (token) {
      await account.embedOAuthSignin(token);
    }
  }

  /**
   * TODO - all {@link excludedPathsForRedirectionCheck} should be defined in routes as dynamic route [...route] is guarded by AuthGuard
   */
  async function performLoginStatusCheck() {
    const resolution = await resolveAuthSession();
    if (resolution.status === "offline-only") {
      return true;
    }

    if (resolution.status === "cached-cloud") {
      if (
        $appStore.product === Product.NUCLEUM &&
        $account.plan &&
        $account.plan.plan !== PlanType.NUCLEUS
      ) {
        navigation.gotoPath("/error/access-denied");
        return false;
      }
      return true;
    }

    if (resolution.status === "expired") {
      logger.warn({
        at: "AuthGuard.performLoginStatusCheck.session.expired",
        currentPath: window.location.pathname
      });
      clearAccountStore();
      navigation.gotoPath("/account/login", {
        queryParams: { msg: "expired" },
        replaceState: true
      });
      return false;
    }

    if (resolution.status === "unavailable") {
      logger.warn({
        at: "AuthGuard.performLoginStatusCheck.session.unavailable",
        error: resolution.error,
        currentPath: window.location.pathname
      });
      navigation.gotoPath("/account/login", {
        queryParams: { msg: "unavailable" },
        replaceState: true
      });
      return false;
    }

    if (resolution.status === "signed-out") {
      clearAccountStore();
      navigation.gotoPath("/account/login", { replaceState: true });
      return false;
    }

    const authSession = resolution.session;
    const subject = authSession.subject ?? {};
    const actorId = String(authSession.actorId ?? "");
    const normalizedActorId = actorId.startsWith("user:")
      ? actorId
      : `user:${actorId}`;
    const unprefixedActorId = normalizedActorId.slice("user:".length);
    const storedUserInfo = resolveStoredUserInformation(
      await clientStorage.get(ClientStorageKey.USER_INFO)
    );
    const currentUserInfo = account.get()?.userInfo ?? storedUserInfo;
    const cachedPlan =
      currentUserInfo?.id === normalizedActorId
        ? account.get()?.plan
        : undefined;
    const userInfo = {
      ...currentUserInfo,
      id: normalizedActorId,
      email: authSession.primaryEmail ?? subject.email ?? "",
      isBootstrapped:
        (
          authSession.metadata?.nucleus as
            { isBootstrapped?: boolean } | undefined
        )?.isBootstrapped ?? false,
      nickName:
        currentUserInfo?.nickName ??
        authSession.primaryEmail?.split("@")[0] ??
        subject.email?.split("@")[0] ??
        "App user",
      joinDate: currentUserInfo?.joinDate ?? new Date(),
      lastLogin: new Date(),
      region: authSession.regionId ?? subject.regionId
    };
    await clientStorage.set(ClientStorageKey.USER, authSession);
    await clientStorage.set(ClientStorageKey.USER_INFO, userInfo);
    logger.info({
      at: "AuthGuard.performLoginStatusCheck.session.ok",
      hasAuthFnToken: Boolean(resolution.storedState.authFnToken),
      hasOfflineSession: Boolean(resolution.storedState.offlineSessionId),
      sessionId: authSession.id,
      regionId: authSession.regionId ?? subject.regionId,
      currentPath: window.location.pathname
    });
    account.update((current) => ({
      ...current,
      token: resolution.storedState.authFnToken,
      dataMode: UserDataMode.CLOUD,
      sessionType: UserSessionType.RETURNING,
      userId: unprefixedActorId,
      userInfo: userInfo as any,
      plan: $appStore.product === Product.NUCLEUM ? cachedPlan : current.plan
    }));
    if ($appStore.product === Product.NUCLEUM) {
      const planResolution = await account.refreshPlanData();
      const plan =
        planResolution.status === "resolved" ? planResolution.plan : cachedPlan;
      if (plan?.plan !== PlanType.NUCLEUS) {
        navigation.gotoPath("/error/access-denied");
        return false;
      }
    }
    return true;
  }

  function clearAccountStore() {
    account.update(() => ({
      dataMode: UserDataMode.NONE,
      sessionType: UserSessionType.UNDETERMINED
    }));
  }
</script>

{@render children?.(isLoggedIn)}
