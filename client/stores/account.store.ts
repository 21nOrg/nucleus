import { navigation } from "@21n/layout/navigation/navigation";
import { get, writable } from "svelte/store";
import { type IUserPlan } from "@nucleum/schema/account/subscription";
import {
  UserDataMode,
  UserSessionType,
  type UserAccount,
  type UserInformation
} from "@nucleum/client/runtime/account/account.type";
import { postDataToParent } from "@nucleum/client/runtime/embed/embed.utils";
import { Persistence } from "@nucleum/persistence/persistence";

import { determineIfOffline } from "@nucleum/client/runtime/connectivity";

import { signout } from "@21n/utils/account.utils";

import { PlanType } from "@nucleum/schema/account/subscription";
import { ObservableStore } from "@nucleum/stores/client.store";
import { StoreDataType } from "@nucleum/schema/legacy/store-data-type.enum";

import { clientStorage } from "@nucleum/persistence/persistence.utils";
import { ClientStorageKey } from "@nucleum/persistence/persistence.type";
import { logger } from "@nucleum/client/runtime/logging/logger";
import { generateSimpleRandomId } from "@21n/shared-utils/crypto.utils";
import { destroyNucleumDatafn } from "@nucleum/datafn/datafn.store";

import context from "@nucleum/stores/context.store";

import { EmbedDataMessage } from "@nucleum/client/runtime/embed/embedMessage.enum";
import { parse } from "@21n/shared-utils/json.utils";
import {
  bootstrapNucleusAccount,
  resolveAuthSession,
  shouldUseAuthFnBearerSession
} from "@nucleum/client/runtime/account/auth";
import { resolveAccountBaseUrl } from "@nucleum/client/runtime/account/network";
import { clearCachedDatafnE2eeState } from "@nucleum/datafn/datafnE2ee.store";

export const isRefreshingToken = writable(false);

export function resolveStoredUserInformation(
  value: string | null
): UserInformation | undefined {
  if (!value) return undefined;
  try {
    const parsed = parse(value) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as { id?: unknown }).id !== "string" ||
      !(parsed as { id: string }).id
    ) {
      return undefined;
    }
    return parsed as UserInformation;
  } catch {
    return undefined;
  }
}

export function resolveStoredUserPlan(
  value: string | null
): IUserPlan | undefined {
  if (!value) return undefined;
  try {
    const parsed = parse(value) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Object.values(PlanType).includes(
        (parsed as { plan?: PlanType }).plan as PlanType
      )
    ) {
      return undefined;
    }
    return parsed as IUserPlan;
  } catch {
    return undefined;
  }
}

class AccountStore extends ObservableStore<UserAccount> {
  persistence = new Persistence();
  constructor() {
    super("account", StoreDataType.NA);
  }

  async init() {
    let seed: UserAccount = {
      dataMode: UserDataMode.NONE,
      sessionType: UserSessionType.UNDETERMINED
    };
    const shouldUseBearerSession = shouldUseAuthFnBearerSession();
    const authFnToken = shouldUseBearerSession
      ? await clientStorage.get(ClientStorageKey.AUTHFN_TOKEN)
      : null;
    const offlineSessionId = await clientStorage.get(
      ClientStorageKey.OFFLINE_SESSION_ID
    );
    const storedUserInfo = await clientStorage.get(ClientStorageKey.USER_INFO);
    const userInfo = resolveStoredUserInformation(storedUserInfo);
    const storedPlan = resolveStoredUserPlan(
      await clientStorage.get(ClientStorageKey.USER_PLAN)
    );
    const storedUser = await clientStorage.get(ClientStorageKey.USER);
    const hasStoredCloudIdentity = Boolean(
      authFnToken || userInfo || storedUser
    );
    if (!shouldUseBearerSession) {
      await clientStorage.remove(ClientStorageKey.AUTHFN_TOKEN);
    }
    if (authFnToken) {
      seed.token = authFnToken;
      seed.dataMode = UserDataMode.CLOUD;
      seed.sessionType = UserSessionType.RETURNING;
    } else if (offlineSessionId && !hasStoredCloudIdentity) {
      seed.dataMode = UserDataMode.LOCAL;
      seed.sessionType = UserSessionType.RETURNING;
    }
    if (userInfo) {
      seed.userInfo = userInfo;
      seed.userId = userInfo.id.split("user:")[1];
      seed.plan = storedPlan;
      seed.dataMode = UserDataMode.CLOUD;
      seed.sessionType = UserSessionType.RETURNING;
    }
    this.set(seed);
    this.postToEmbed(seed);
  }

  async postToEmbed(data: any = null) {
    if (!data) {
      const token = shouldUseAuthFnBearerSession()
        ? await clientStorage.get(ClientStorageKey.AUTHFN_TOKEN)
        : undefined;
      const userInfo = parse(
        (await clientStorage.get(ClientStorageKey.USER_INFO)) ?? ""
      );
      data = { token, userInfo };
    }
    if (!data) return;
    postDataToParent(EmbedDataMessage.ACCOUNT, {
      userId: data.userInfo?.id?.split("user:")[1],
      token: data.token,
      regionId: data.userInfo?.region,
      accountUrl: data.userInfo?.region
        ? resolveAccountBaseUrl(data.userInfo.region)
        : undefined,
      isLoggedIn: true
    });
  }

  async signIn(
    data: {
      userInfo: UserInformation;
      token: string;
    },
    params: {
      isNewUser?: boolean;
      persistToken?: boolean;
    } = { isNewUser: false }
  ) {
    const shouldPersistToken =
      params.persistToken ?? shouldUseAuthFnBearerSession();
    if (shouldPersistToken) {
      await clientStorage.set(ClientStorageKey.AUTHFN_TOKEN, data.token);
    } else {
      await clientStorage.remove(ClientStorageKey.AUTHFN_TOKEN);
    }
    await clientStorage.remove(ClientStorageKey.STOKEN);
    await clientStorage.set(ClientStorageKey.USER_INFO, data.userInfo);
    this.postToEmbed({
      token: shouldPersistToken ? data.token : undefined,
      userInfo: data.userInfo
    });
    this.update(() => {
      return {
        token: shouldPersistToken ? data.token : undefined,
        dataMode: UserDataMode.CLOUD,
        userId: data.userInfo.id.split("user:")[1],
        userInfo: data.userInfo,
        sessionType: params.isNewUser
          ? UserSessionType.NEW
          : UserSessionType.RETURNING
      };
    });
    this.gotoPostAuthRoute({ isNewUser: params.isNewUser });
  }

  gotoPostAuthRoute(params?: { isNewUser?: boolean }) {
    const targetPath = params?.isNewUser ? "/onboarding" : "/";
    logger.info({
      at: "account.gotoPostAuthRoute",
      targetPath,
      isNewUser: params?.isNewUser,
      currentPath:
        typeof window !== "undefined" ? window.location.pathname : undefined
    });
    if (params?.isNewUser) {
      navigation.gotoPath("/onboarding");
    } else {
      navigation.gotoPath("/");
    }
  }

  async signOut(params?: {
    isPreventDapIdClear?: boolean;
    isPreventRedirect?: boolean;
  }) {
    try {
      await destroyNucleumDatafn();
    } catch (error) {
      logger.error({ at: "account.signOut.destroyDatafn", error });
    }
    await clearCachedDatafnE2eeState();
    this.update(() => {
      const n = {
        sessionType: UserSessionType.UNDETERMINED,
        dataMode: UserDataMode.NONE
      };
      return n;
    });

    await signout(params, "signOut account.store");
  }
  async embedOAuthSignin(token: string) {
    await clientStorage.set(ClientStorageKey.AUTHFN_TOKEN, token);
    await clientStorage.remove(ClientStorageKey.STOKEN);
    const response = await this.resolveAuthFnSessionUserInfo();
    if (response?.userInfo) {
      this.signIn({
        userInfo: response?.userInfo,
        token
      });
    } else {
      logger.error({ at: "account.embedOAuthSignin", response });
    }
  }

  async signInFromAuthFnSession(params?: {
    token?: string;
    session?: any;
    regionId?: string;
    isNewUser?: boolean;
    isPreventRedirect?: boolean;
    persistToken?: boolean;
  }) {
    const shouldPersistToken =
      params?.persistToken ?? shouldUseAuthFnBearerSession();
    const previousAuthFnToken = shouldPersistToken
      ? await clientStorage.get(ClientStorageKey.AUTHFN_TOKEN)
      : undefined;
    const hasTokenFromResponse = Boolean(params?.token?.trim());
    if (shouldPersistToken && hasTokenFromResponse && params?.token) {
      await clientStorage.set(ClientStorageKey.AUTHFN_TOKEN, params.token);
    } else if (!shouldPersistToken) {
      await clientStorage.remove(ClientStorageKey.AUTHFN_TOKEN);
    }
    if (params?.regionId) {
      await clientStorage.set(ClientStorageKey.REGION, params.regionId);
    }

    let authSession = params?.session;
    if (!authSession) {
      const { authClient } =
        await import("@nucleum/client/runtime/account/auth");
      const response = await (
        await authClient({ isPreventCachedInstance: true })
      ).getSession();
      if (response.ok && response.data.session) {
        authSession = response.data.session;
      }
      if (!response.ok || !response.data.session) {
        logger.error({
          at: "account.signInFromAuthFnSession.session.failed",
          hasTokenFromResponse,
          error: response.ok ? undefined : response.error
        });
      }
    }

    if (!authSession) {
      if (shouldPersistToken && hasTokenFromResponse) {
        if (previousAuthFnToken) {
          await clientStorage.set(
            ClientStorageKey.AUTHFN_TOKEN,
            previousAuthFnToken
          );
        } else {
          await clientStorage.remove(ClientStorageKey.AUTHFN_TOKEN);
        }
      }
      return false;
    }

    const sessionToken = shouldPersistToken
      ? (params?.token ?? previousAuthFnToken ?? undefined)
      : undefined;
    if (shouldPersistToken && sessionToken) {
      await clientStorage.set(ClientStorageKey.AUTHFN_TOKEN, sessionToken);
    } else {
      await clientStorage.remove(ClientStorageKey.AUTHFN_TOKEN);
    }
    await clientStorage.remove(ClientStorageKey.STOKEN);
    await clientStorage.set(ClientStorageKey.USER, authSession);

    const userInfo = this.resolveUserInfoFromAuthFnSession(authSession);
    await clientStorage.set(ClientStorageKey.USER_INFO, userInfo);
    this.postToEmbed({ token: sessionToken, userInfo });
    this.update(() => ({
      token: sessionToken,
      dataMode: UserDataMode.CLOUD,
      sessionType: params?.isNewUser
        ? UserSessionType.NEW
        : UserSessionType.RETURNING,
      userId: userInfo.id.split("user:")[1],
      userInfo
    }));

    logger.info({
      at: "account.signInFromAuthFnSession.ok",
      hasSessionToken: Boolean(sessionToken),
      isNewUser: params?.isNewUser,
      isPreventRedirect: params?.isPreventRedirect,
      userId: userInfo.id,
      region: userInfo.region,
      dataMode: UserDataMode.CLOUD,
      currentPath:
        typeof window !== "undefined" ? window.location.pathname : undefined
    });

    if (params?.isPreventRedirect) return true;
    this.gotoPostAuthRoute({ isNewUser: params?.isNewUser });
    return true;
  }

  private async resolveAuthFnSessionUserInfo(): Promise<{
    userInfo: UserInformation;
  } | null> {
    const { authClient } = await import("@nucleum/client/runtime/account/auth");
    const response = await (await authClient()).getSession();
    if (!response.ok || !response.data.session) {
      return null;
    }
    const session = response.data.session;
    return { userInfo: this.resolveUserInfoFromAuthFnSession(session) };
  }

  private resolveUserInfoFromAuthFnSession(session: any): UserInformation {
    const metadata = (session.metadata ?? {}) as {
      nucleus?: {
        isBootstrapped?: boolean;
        nickName?: string;
        profilePictureUrl?: string;
      };
    };
    const subject = session.subject ?? {};
    const email = session.primaryEmail ?? subject.email ?? "";
    const actorId = String(session.actorId ?? "");
    const id = actorId.startsWith("user:") ? actorId : `user:${actorId}`;
    return {
      id,
      email,
      nickName: metadata.nucleus?.nickName ?? email.split("@")[0] ?? "",
      joinDate: new Date(),
      lastLogin: new Date(),
      profilePictureUrl: metadata.nucleus?.profilePictureUrl,
      isBootstrapped: metadata.nucleus?.isBootstrapped ?? false,
      region: session.regionId ?? subject.regionId
    };
  }

  async refreshPlanData() {
    try {
      const isOffline = await determineIfOffline();
      if (isOffline) return { status: "unavailable" as const };
      const response = await this.persistence.getUserPlan();
      if (response === undefined) {
        return { status: "unavailable" as const };
      }
      const data = Array.isArray(response)
        ? response[0]?.result?.[0]
        : response;
      if (data?.userPlan) {
        await clientStorage.set(ClientStorageKey.USER_PLAN, data.userPlan);
        this.update((n) => {
          n.plan = data.userPlan;
          return n;
        });
        return {
          status: "resolved" as const,
          plan: data.userPlan as IUserPlan
        };
      }
      await clientStorage.remove(ClientStorageKey.USER_PLAN);
      this.update((n) => ({ ...n, plan: undefined }));
      return { status: "resolved" as const, plan: undefined };
    } catch (e) {
      logger.error({ at: "refreshPlanData", error: e });
      return { status: "unavailable" as const, error: e };
    }
  }

  async logGuest(id: string) {
    try {
      return this.persistence.runAccountAction("guest", { id });
    } catch (e) {
      logger.error({ at: "logGuest", error: e });
    }
  }

  async startOfflineSession() {
    this.update((n) => {
      n.token = undefined;
      n.userId = undefined;
      n.userInfo = undefined;
      n.dataMode = UserDataMode.LOCAL;
      n.sessionType = UserSessionType.RETURNING;
      return n;
    });
    await clientStorage.remove(ClientStorageKey.AUTHFN_TOKEN);
    await clientStorage.remove(ClientStorageKey.STOKEN);
    await clientStorage.remove(ClientStorageKey.USER);
    await clientStorage.remove(ClientStorageKey.USER_INFO);
    await this.ensureOfflineSession();
  }

  async ensureOfflineSession() {
    const existingSessionId = await clientStorage.get(
      ClientStorageKey.OFFLINE_SESSION_ID
    );
    if (existingSessionId) return existingSessionId;
    const sessionId = generateSimpleRandomId();
    await clientStorage.set(ClientStorageKey.OFFLINE_SESSION_ID, sessionId);
    return sessionId;
  }

  async bootstrap(region: string) {
    const authFnResult = await this.bootstrapAuthFn(region);
    if (authFnResult !== "not-authfn") {
      return authFnResult;
    }
    return this.bootstrapRemote(region);
  }

  private async bootstrapAuthFn(
    region: string
  ): Promise<boolean | "not-authfn"> {
    const result = await bootstrapNucleusAccount(region);
    if (result.kind === "not-authfn") {
      return "not-authfn";
    }
    if (result.kind === "failed") {
      logger.error({
        at: "account.bootstrapAuthFn.failed",
        status: result.status,
        error: result.error
      });
      return false;
    }

    await this.signInFromAuthFnSession({
      token: result.token,
      session: result.session,
      regionId: result.session.regionId ?? region,
      isNewUser: true,
      isPreventRedirect: true
    });
    this.gotoPostAuthRoute({ isNewUser: true });
    return true;
  }

  async bootstrapRemote(region: string) {
    const id = this.get()?.userInfo?.id?.split("user:")[1];
    if (!id) return;
    const response = await this.persistence.runAccountAction("bootstrap", {
      id,
      region
    });
    if (!response || response.error || !response.userInfo) {
      return false;
    }
    this.signIn(
      {
        userInfo: response.userInfo,
        token: response.token
      },
      {
        isNewUser: true
      }
    );
    return true;
  }

  async checkIfSessionExpired() {
    const resolution = await resolveAuthSession();
    return !["authenticated", "offline-only", "cached-cloud"].includes(
      resolution.status
    );
  }

  isCloudUserAndOffline() {
    const account = this.get();
    const ctx = get(context);
    if (account.dataMode === UserDataMode.CLOUD && ctx.isInOfflineMode)
      return true;
    return false;
  }

  isCloudUserAndOnline() {
    const account = this.get();
    const ctx = get(context);
    if (account.dataMode === UserDataMode.CLOUD && !ctx.isInOfflineMode)
      return true;
    return false;
  }
}

const account = new AccountStore();
export default account;
