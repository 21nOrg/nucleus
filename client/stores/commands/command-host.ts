import type { IAction } from "@nucleum/client/config/action.type";
import type { Resource } from "@nucleum/datafn/resource.enum";
import type { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";

/** Application command execution supplied by the composing shell. */
export interface CommandHost {
  resolveAction(slug: string): IAction | null;
  runAction(
    slug: string,
    params?: {
      componentParams?: any;
      isReturnIfComponent?: boolean;
      searchParams?: Record<string, string | boolean | number>;
    }
  ): any;
  runResourceAction(
    resource: Resource,
    action: ResourceActionType,
    params?: any
  ): any;
}
let commandHost: CommandHost | undefined;
/** Installs the product command executor before mounting application surfaces. */
export function configureCommandHost(host: CommandHost) {
  commandHost = host;
}
/** Requires the composing shell to supply command behavior. */
export function requireCommandHost(): CommandHost {
  if (!commandHost) throw new Error("Command host has not been configured");
  return commandHost;
}
