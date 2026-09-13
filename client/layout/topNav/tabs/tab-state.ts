import { ResourceAccessPoint } from "@nucleum/datafn/resource.type";

import { UIStateScope } from "@nucleum/stores/uiState/uiState.type";

import type { IRecordId } from "@nucleum/schema/legacy/data.type";
import { toasts } from "@nucleum/stores/notification.store";
import { resourceInList, isSameResource } from "@nucleum/datafn/resource.utils";

import { uiState } from "@nucleum/stores/uiState/uiState.store";
/** Persisted navigation behavior owned by the corresponding layout. */
export const tabState = {
  addResourceToTabs(id: IRecordId) {
    const current = uiState.getState(ResourceAccessPoint.TABS, {
      scope: UIStateScope.PRODUCT
    });
    if (current?.includes(id.toString())) {
      toasts.error("Resource already present in top bar");
      return;
    }
    uiState.setState(
      ResourceAccessPoint.TABS,
      [...(current ?? []), id.toString()],
      {
        scope: UIStateScope.PRODUCT
      }
    );
  },
  removeResourceFromTabs(id: IRecordId) {
    const current = uiState.getState(ResourceAccessPoint.TABS, {
      scope: UIStateScope.PRODUCT
    });
    if (!current?.some(resourceInList(id))) return;
    uiState.setState(
      ResourceAccessPoint.TABS,
      current.filter((x: IRecordId) => !isSameResource(x, id)),
      {
        scope: UIStateScope.PRODUCT
      }
    );
  }
};
