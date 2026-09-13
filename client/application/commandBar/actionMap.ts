import { navigation } from "@21n/layout/navigation/navigation";
import { requireCommandHost } from "@nucleum/stores/commands/command-host";
import { sidebarState } from "@21n/layout/leftPanel/sidebar-state";
import {
  type IAction,
  type IActionFnParams,
  ActionType,
  ContentType
} from "@nucleum/client/config/action.type";
import PageError from "@nucleum/application/error/PageError.svelte";
import DebugLogs from "@nucleum/application/error/DebugLogs.svelte";
import Offline from "@nucleum/application/error/Offline.svelte";
import Signup from "@nucleum/application/settings/account/Signup.svelte";
import ToastModalPortrait from "@21n/elements/feedback/ToastModalPortrait.svelte";
import CommandBar from "@nucleum/application/commandBar/CommandBar.svelte";
import { Size } from "@21n/elements/size.enum";
import { Orientation, Placement } from "@21n/elements/direction.enum";
import { intercomId, isInEditMode } from "@nucleum/stores/app.store";
import Help from "@nucleum/application/help/Help.svelte";
import ExtensionLoginStatusPage from "@nucleum/application/settings/ExtensionLoginStatusPage.svelte";
import DebugPage from "@21n/layout/layers/debug/DebugPage.svelte";
import modalEvent from "@nucleum/stores/overlays/modal.store";
import { Action } from "@nucleum/client/config/action.enum";
import Bootstrap from "@nucleum/application/settings/account/Bootstrap.svelte";
import Calendar from "@nucleum/features/calendar/Calendar.svelte";
import { GlobalEvent } from "@nucleum/stores/notifications/event.enum";

import BookACall from "@nucleum/application/cx/BookACall.svelte";
import MdShortcuts from "@nucleum/features/memory/markdown/shortcuts/MdShortcuts.svelte";
import CoverPicker from "@21n/elements/coverPicker/CoverPicker.svelte";
import SignalDBViewer from "@nucleum/application/debug/SignalDBViewer.svelte";
import CalendarSettings from "@nucleum/features/calendar/settings/CalendarSettings.svelte";
import { Embed } from "@nucleum/client/runtime/context.type";
import {
  AccessMode,
  type IMultiSelectStore
} from "@nucleum/datafn/resource.type";
import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
import {
  determineResourceType,
  resourceAction
} from "@nucleum/datafn/resource.utils";
import { Resource } from "@nucleum/datafn/resource.enum";
import CreateCollection from "@nucleum/features/collections/CreateCollection.svelte";
import CreateEvent from "@nucleum/features/calendar/events/CreateEvent.svelte";
import Event from "@nucleum/features/calendar/events/Event.svelte";
import PropertiesEditor from "@nucleum/features/collections/properties/PropertiesEditor.svelte";
import CreateCombination from "@nucleum/features/spaces/combination/CreateCombination.svelte";
import { ResourceError } from "@nucleum/datafn/resource-error";
import { ResourceErrorCode } from "@nucleum/schema/resource-error.enum";
import CollectionTitleLabelPart from "@nucleum/features/collections/thumbnail/CollectionThumbnailLabel.svelte";
import PropertyConfig from "@nucleum/features/collections/properties/propertyConfig/PropertyConfig.svelte";
import { logger } from "@nucleum/client/runtime/logging/logger";
import { toasts } from "@nucleum/stores/notification.store";
import NodeLoadingPulse from "@21n/elements/feedback/animations/NodeLoadingPulse.svelte";
import LinkSearchResultItem from "@nucleum/features/memory/common/linkbox/LinkSearchResultItemDummy.svelte";
import { queryLinkingSearchResults } from "@nucleum/features/memory/linking/link-search";
import { recentsStore } from "@nucleum/stores/resources/recent.store";
import { isValidString } from "@21n/shared-utils/text.utils";
import ResourceBrowser from "@nucleum/application/library/resourceBrowser/ResourceBrowser.svelte";
import UserPlan from "@nucleum/application/subscription/UserPlan.svelte";
import InactivePlan from "@nucleum/application/subscription/InactivePlan.svelte";
import { ButtonVariant } from "@21n/elements/button/button.type";
import PaymentRedirect from "@nucleum/application/subscription/PaymentRedirect.svelte";
import PlanOnboarding from "@nucleum/application/subscription/PlanOnboarding.svelte";
import type { IRecordId } from "@nucleum/schema/legacy/data.type";
import UserBilling from "@nucleum/application/subscription/UserBilling.svelte";
import UserPlanCancellation from "@nucleum/application/subscription/UserPlanCancellation.svelte";
import DocusaurusEmbed from "@nucleum/application/cx/docusaurus/DocusaurusEmbed.svelte";
import ResourceSearchModal from "@nucleum/products/memotron/library/search/ResourceSearchModal.svelte";
import Collection from "@nucleum/features/collections/DummyCollection.svelte";
import AppLoadingView from "@21n/layout/paint/AppLoadingView.svelte";
import SimpleDigitalClock from "@nucleum/products/pointron/clocks/SimpleDigitalClock.svelte";
import Test from "@nucleum/application/debug/Test.svelte";
import SampleCalendarItemThumbnail from "@nucleum/features/calendar/column/timeline/SampleCalendarItemThumbnail.svelte";
import FocusCalendarEntryThumbnail from "@nucleum/features/calendar/column/timeline/focusEntry/FocusCalendarEntryThumbnail.svelte";
import CalendarDayModal from "@nucleum/features/calendar/column/CalendarDayModal.svelte";
import HotKeys from "@nucleum/features/memory/markdown/shortcuts/HotKeys.svelte";
import HistoryModal from "@nucleum/features/calendar/HistoryModal.svelte";
import Credits from "@nucleum/application/help/Credits.svelte";
import DataSettings from "@nucleum/application/settings/DataSettings.svelte";
import DexieConsole from "@nucleum/application/debug/DexieConsole.svelte";
import { AppSearchParam } from "@nucleum/stores/appStore.type";
import OfflineStatusModal from "@nucleum/application/settings/sync/OfflineStatusModal.svelte";
import context from "@nucleum/stores/context.store";
import view from "@nucleum/stores/view.store";
import Navigator from "@21n/layout/navigator/Navigator.svelte";
import ComingSoonView from "@21n/elements/ComingSoonView.svelte";
import Today from "@nucleum/features/calendar/Today.svelte";
import { activeResourceFilter } from "@21n/utils/utils";
import DatafnSharePanel from "@nucleum/application/share/DatafnSharePanel.svelte";
import { datafn } from "@nucleum/datafn/datafn.store";
import { appMenuActionLabelsByAction } from "@nucleum/client/config/product-nav.config";
import {
  addDatafnRecordToCollection,
  relateDatafnRecords
} from "@nucleum/datafn/datafn-linking.store";

function isCollectionItemResource(resource: Resource) {
  return resource === Resource.node || resource === Resource.objective;
}

export const globalActions: IAction[] = [
  {
    action: Action.CREDITS,
    label: "Credits",
    icon: "heart",
    type: ActionType.MODAL,
    component: Credits,
    modalParams: {
      title: "Credits & Appreciation",
      layout: {
        size: Size.lg,
        orientation: Orientation.Horizontal
      }
    }
  },
  {
    action: "404",
    type: ActionType.PAGE,
    isMeta: true,
    component: PageError,
    isMenuHidden: true
  },
  {
    action: "error",
    type: ActionType.PAGE,
    isMeta: true,
    component: PageError,
    isMenuHidden: true
  },
  {
    action: "offline",
    type: ActionType.PAGE,
    isMeta: true,
    component: Offline
  },
  {
    action: Action.EXTENSTION_LOGIN,
    type: ActionType.PAGE,
    isMeta: true,
    component: ExtensionLoginStatusPage,
    isMenuHidden: true
  },
  {
    action: "signup",
    component: Signup,
    type: ActionType.PAGE,
    isMeta: true,
    isMenuHidden: true
  },
  {
    action: "debuglogs",
    icon: "code",
    type: ActionType.PAGE,
    isMeta: true,
    component: DebugLogs
  },
  {
    action: "web",
    label: "Open web app",
    icon: "link",
    isMeta: true,
    type: ActionType.LINK
  },
  {
    action: Action.DOCS,
    label: "Guides and docs",
    icon: "book-open",
    isMeta: true,
    type: ActionType.FUNCTION,
    fn: async (params?: IActionFnParams) => {
      if (
        params?.context?.embed === Embed.HANDSET ||
        params?.context?.embed === Embed.TABLET
      ) {
        requireCommandHost().runAction(Action.DOCS + "mobile");
      } else {
        requireCommandHost().runAction(Action.DOCS + "docusaurus");
      }
    }
  },
  {
    action: Action.DOCS + "mobile",
    label: "Guides and docs",
    icon: "book-open",
    isMeta: true,
    type: ActionType.LINK
  },
  {
    action: Action.DOCS + "docusaurus",
    label: "Guides and docs",
    icon: "book-open",
    cmdLabel: [
      { variant: "documentation", label: "Documentation" },
      { variant: "guides", label: "Guides" }
    ],
    type: ActionType.MODAL,
    component: DocusaurusEmbed,
    componentParams: {
      context: "docs"
    },
    modalParams: {
      layout: {
        size: Size.xxl,
        orientation: Orientation.Horizontal,
        ignoreSafeArea: true
      }
    }
  },
  {
    action: "tutorials",
    label: "Tutorials",
    icon: "youtube",
    type: ActionType.LINK
  },
  {
    action: "downloads",
    label: "Downloads",
    icon: "download",
    type: ActionType.LINK
  },
  {
    action: "chat",
    label: "Chat with us",
    icon: "chats",
    type: ActionType.FUNCTION,
    isMeta: true,
    fn: async () => {
      modalEvent.hide(Action.HELP);
      modalEvent.hide(Action.SETTINGS);
      setTimeout(() => {
        if ((window as any).Intercom) {
          (window as any).Intercom("boot", {
            app_id: intercomId
          });
          (window as any).Intercom("show");
        } else {
          console.error("Intercom is not defined");
        }
      }, 300);
    }
  },
  {
    action: "call",
    label: "Book a call",
    icon: "video-conference",
    type: ActionType.MODAL,
    component: BookACall
  },
  {
    action: "faqs",
    label: "FAQs",
    icon: "question",
    type: ActionType.MODAL,
    handsetBehaviorType: ActionType.LINK,
    component: DocusaurusEmbed,
    componentParams: {
      context: "faqs"
    },
    modalParams: {
      layout: {
        size: Size.xxl,
        orientation: Orientation.Horizontal,
        ignoreSafeArea: true
      }
    }
  },
  {
    action: Action.CHANGELOG,
    label: "What's new",
    icon: "sparkle",
    cmdLabel: [
      { variant: "whatsNew", label: "What's new" },
      { variant: "changelog", label: "Changelog" }
    ],
    type: ActionType.MODAL,
    handsetBehaviorType: ActionType.LINK,
    component: DocusaurusEmbed,
    componentParams: {
      context: "changelog"
    },
    modalParams: {
      layout: {
        size: Size.xxl,
        orientation: Orientation.Horizontal,
        ignoreSafeArea: true
      }
    }
  },
  {
    action: Action.ROADMAP,
    label: "Roadmap",
    icon: "map",
    type: ActionType.MODAL,
    handsetBehaviorType: ActionType.LINK,
    component: DocusaurusEmbed,
    componentParams: {
      context: "roadmap"
    },
    modalParams: {
      layout: {
        size: Size.xxl,
        orientation: Orientation.Horizontal,
        ignoreSafeArea: true
      }
    }
  },

  {
    action: "discord",
    label: "Join us on discord",
    icon: "discord",
    type: ActionType.LINK
  },
  {
    action: "opencollective",
    label: "Support us",
    icon: "gift",
    isInactive: true,
    type: ActionType.LINK
  },
  {
    action: "twitter",
    label: "Twitter",
    icon: "twitter",
    type: ActionType.LINK
  },
  {
    action: "reddit",
    label: "Reddit",
    icon: "reddit",
    type: ActionType.LINK
  },
  {
    action: "bluesky",
    label: "Bluesky",
    icon: "butterfly",
    type: ActionType.LINK
  },
  {
    action: "instagram",
    label: "Instagram",
    icon: "instagram",
    type: ActionType.LINK
  },
  {
    action: "git",
    label: "Star us on git",
    icon: "star",
    isInactive: true,
    type: ActionType.LINK
  },
  {
    action: Action.PRIVACY_POLICY,
    get label() {
      return this.modalParams?.title;
    },
    icon: "lock",
    type: ActionType.LINK,

    modalParams: {
      title: "Privacy policy",
      layout: {
        size: Size.xl
      }
    }
  },
  {
    action: Action.TERMS_OF_SERVICE,
    get label() {
      return this.modalParams?.title;
    },
    icon: "lock",
    isMeta: true,
    type: ActionType.LINK,
    contentType: ContentType.SPACE_DOC,
    modalParams: {
      title: "Terms of service",
      layout: {
        size: Size.xl
      }
    }
  },
  {
    action: Action.TERMS_OF_SERVICE_APPLE,
    isMeta: true,
    type: ActionType.LINK
  },
  {
    action: "feedback",
    label: "Give feedback",
    icon: "chat-three",
    isInactive: true,
    type: ActionType.LINK
  },
  {
    action: "requestfeature",
    label: "Request a feature",
    icon: "lightbulb",
    type: ActionType.LINK
  },
  {
    action: "report",
    label: "Report an issue",
    cmdLabel: [
      { variant: "report", label: "Report an issue" },
      { variant: "feedback", label: "Give feedback" }
    ],
    icon: "flag",
    type: ActionType.LINK
  },
  {
    action: Action.MOBILE_TOAST,
    component: ToastModalPortrait,
    type: ActionType.MODAL,
    isMeta: true,
    modalParams: {
      layout: {
        size: Size.xs
      }
    }
  },
  {
    action: Action.EDIT_MODE,
    fn: async () => isInEditMode.toggle(),
    type: ActionType.FUNCTION,
    isMeta: true,
    label: "Edit mode"
  },
  {
    action: Action.HELP,
    label: "Help",
    icon: "help",
    type: ActionType.MODAL,
    component: Help,
    modalParams: {
      layout: {
        size: Size.lg,
        orientation: Orientation.Horizontal,
        ignoreSafeArea: true,
        isShowCantileverClose: true
      }
    }
  },
  {
    action: Action.CMD,
    icon: "terminal-window",
    label: "Command bar",
    component: CommandBar,
    type: ActionType.MODAL,
    isMeta: true,
    modalParams: {
      isShowOverlay: false,
      layout: {
        ignoreSafeArea: true,
        isDynamicSize: true,
        alignment: Placement.TopCenter
      }
    }
  },
  {
    action: Action.TOGGLE_SIDEBAR,
    type: ActionType.FUNCTION,
    label: "Toggle sidebar",
    fn: async () => {
      sidebarState.toggleSidebar();
    }
  },
  {
    action: "troubleshoot",
    label: "Troubleshoot",
    type: ActionType.MODAL,
    component: DebugPage,
    modalParams: {
      layout: {
        size: Size.xxl,
        orientation: Orientation.Horizontal
      }
    }
  },
  {
    action: "bootstrap",
    type: ActionType.PAGE,
    isMenuHidden: true,
    isMeta: true,
    component: Bootstrap
  },
  {
    action: Action.CALENDAR,
    label: appMenuActionLabelsByAction[Action.CALENDAR],
    icon: "calendar",
    type: ActionType.PAGE,
    component: Calendar
  },
  {
    action: GlobalEvent.ACTIVATE_SEARCH_BOX,
    label: "Activate search box",
    isMeta: true,
    type: ActionType.EVENT
  },
  {
    action: Action.MARKDOWN_SHORTCUTS,
    label: "Markdown shortcuts",
    component: MdShortcuts,
    type: ActionType.MODAL,
    modalParams: {
      title: "Markdown shortcuts",
      layout: {
        size: Size.lg
      }
    }
  },
  {
    action: Action.HOT_KEYS,
    label: "See hot key shortcuts",
    component: HotKeys,
    type: ActionType.MODAL,
    modalParams: {
      title: "Hot key shortcuts",
      layout: {
        size: Size.lg
      }
    }
  },
  {
    action: Action.COVER_PICKER,
    component: CoverPicker,
    isMeta: true,
    type: ActionType.MODAL,
    modalParams: {
      layout: {
        size: Size.lg
      }
    }
  },
  {
    action: "dexie-console",
    component: DexieConsole,
    isMeta: true,
    type: ActionType.MODAL,
    modalParams: {
      layout: {
        size: Size.xxl,
        orientation: Orientation.Horizontal
      }
    }
  },
  {
    action: "signaldb-console",
    component: SignalDBViewer,
    isMeta: true,
    type: ActionType.MODAL,
    modalParams: {
      layout: {
        size: Size.xxl,
        orientation: Orientation.Horizontal
      }
    }
  },
  {
    action: Action.GO_BACK,
    label: "Go back",
    isMeta: true,
    type: ActionType.FUNCTION,
    fn: async () => {
      navigation.goBack();
    }
  },
  {
    action: Action.GO_FORWARD,
    label: "Go forward",
    isMeta: true,
    type: ActionType.FUNCTION,
    fn: async () => {
      navigation.goForward();
    }
  },
  {
    action: resourceAction(Resource.collection, ResourceActionType.CREATE),
    component: CreateCollection,
    label: "Create a new collection",
    type: ActionType.MODAL,
    modalParams: {
      layout: {
        size: Size.md,
        orientation: Orientation.Horizontal,
        ignoreSafeArea: true
      }
    }
  },
  {
    action: resourceAction(Resource.event, ResourceActionType.CREATE),
    component: CreateEvent,
    label: "Create a new event",
    type: ActionType.MODAL,
    modalParams: {
      title: "Create event",
      layout: {
        size: Size.md,
        orientation: Orientation.Vertical,
        ignoreSafeArea: true
      }
    }
  },
  {
    action: resourceAction(Resource.property, ResourceActionType.EDIT),
    component: PropertiesEditor,
    type: ActionType.MODAL,
    isMeta: true,
    modalParams: {
      layout: {
        size: Size.xxl,
        orientation: Orientation.Horizontal,
        isOveriddenFooter: true
      }
    }
  },
  {
    action: resourceAction(Resource.space, ResourceActionType.CREATE),
    component: CreateCombination,
    label: "Create a new space",
    type: ActionType.MODAL,
    isInactive: false,
    modalParams: {
      title: "Create a new space",
      layout: {
        size: Size.sm,
        orientation: Orientation.Vertical,
        isOveriddenFooter: true
      }
    }
  },
  ...[
    Resource.collection,
    Resource.node,
    Resource.objective,
    Resource.task,
    Resource.session,
    Resource.event,
    Resource.file,
    Resource.space
  ].map((resource) => ({
    action: resourceAction(resource, ResourceActionType.SHARE),
    component: DatafnSharePanel,
    label: "Share",
    icon: "share",
    type: ActionType.MODAL,
    componentParams: {
      resource
    },
    modalParams: {
      title: "Share",
      layout: {
        size: Size.md,
        orientation: Orientation.Vertical,
        ignoreSafeArea: true
      }
    }
  })),
  {
    action: Resource.collection,
    type: ActionType.MODAL,
    component: Collection,
    resourceLabelRenderer: CollectionTitleLabelPart,
    modalParams: {
      layout: {
        size: Size.xxl,
        orientation: Orientation.Horizontal,
        ignoreSafeArea: true,
        isShowCantileverClose: true,
        isShowBackButton: true
      }
    }
  },
  {
    action: Resource.event,
    type: ActionType.MODAL,
    component: Event,
    modalParams: {
      layout: {
        size: Size.lg,
        orientation: Orientation.Vertical,
        ignoreSafeArea: true,
        isShowCantileverClose: true,
        isShowBackButton: true
      }
    }
  },
  {
    action: resourceAction(Resource.collection, ResourceActionType.BROWSE),
    component: ResourceBrowser,
    label: "Collections",
    icon: "collection",
    type: ActionType.PAGE,
    componentParams: {
      resource: Resource.collection
    },
    loadingComponent: NodeLoadingPulse
  },
  {
    action: resourceAction(Resource.event, ResourceActionType.BROWSE),
    component: ResourceBrowser,
    label: "Events",
    icon: "calendar-blank",
    type: ActionType.PAGE,
    componentParams: {
      resource: Resource.event
    },
    loadingComponent: NodeLoadingPulse
  },
  {
    action: resourceAction(Resource.tag, ResourceActionType.BROWSE),
    component: ResourceBrowser,
    label: "Tags",
    icon: "tag",
    isInactive: true,
    type: ActionType.PAGE,
    componentParams: {
      resource: Resource.tag
    }
  },
  {
    action: Action.ADD_ITEM_TO_COLLECTION,
    type: ActionType.SEARCH_CMD,
    cmdLabel: "Add to collection",
    isMeta: true,
    searchActionParams: {
      placeholder: "select an item to add to this collection",
      searchResultComponent: LinkSearchResultItem,
      searchCallback: async (query: string, componentParams?: any) => {
        const resource = componentParams?.resource ?? Resource.node;
        if (isValidString(query)) {
          const result = await datafn.search({
            query,
            resources: [resource],
            limit: 50,
            limitPerResource: 50,
            source: "local",
            prefix: true,
            fuzzy: 0.2
          });
          return (result.results?.map((entry: any) => entry.data) ?? []).filter(
            activeResourceFilter
          );
        } else {
          return recentsStore.resolve({ type: resource });
        }
      },
      callback: async (item: any, componentParams?: any) => {
        try {
          if (!componentParams?.id) {
            toasts.error();
            return;
          }
          const resource = determineResourceType(item.id);
          if (!isCollectionItemResource(resource)) {
            toasts.error();
            return;
          }
          const result = await addDatafnRecordToCollection({
            sourceId: item.id,
            collectionId: componentParams.id,
            context: componentParams.id.toString()
          });
          logger.log({
            at: "addNodeToCollection",
            id: item.id,
            label: item.label,
            componentParams,
            result
          });
          if (result === 0) {
            toasts.error("Already added to collection");
            return;
          }
          toasts.success(`**${item.label}** added to collection`);
        } catch (e) {
          logger.error({ at: "addNodeToCollection", error: e });
          if (e instanceof ResourceError) {
            if (e.code === ResourceErrorCode.ALREADY_EXISTS) {
              toasts.error("Already added to collection");
            } else {
              toasts.error();
            }
          } else {
            toasts.error();
          }
        }
      }
    }
  },
  {
    action: "propertyConfig",
    type: ActionType.INLINE,
    isMeta: true,
    component: PropertyConfig
  },
  {
    action: Action.USER_PLAN,
    type: ActionType.MODAL,
    isMeta: true,
    component: UserPlan,
    modalParams: {
      layout: {
        size: Size.full,
        orientation: Orientation.Horizontal
      }
    }
  },
  {
    action: Action.INACTIVE_PLAN,
    type: ActionType.MODAL,
    isMeta: true,
    // label: "inactive plan",
    component: InactivePlan,
    modalParams: {
      isDismissable: false,
      layout: {
        size: Size.md,
        orientation: Orientation.Horizontal,
        primaryAction: {
          label: "Upgrade now",
          icon: "sparkle",
          variant: ButtonVariant.PRIMARY,
          callback: async () => {
            requireCommandHost().runAction(Action.USER_PLAN);
          }
        },
        secondaryAction: {
          label: "Use offline",
          icon: "offline",
          variant: ButtonVariant.SECONDARY,
          callback: async () => {
            await context.toggleOfflineMode(true);
            modalEvent.hide(Action.INACTIVE_PLAN);
          }
        }
      }
    }
  },
  {
    action: "pay",
    type: ActionType.PAGE,
    component: PaymentRedirect
  },
  {
    action: Action.PLAN_ONBOARDING,
    isMeta: true,
    type: ActionType.MODAL,
    component: PlanOnboarding,
    modalParams: {
      layout: {
        size: Size.lg,
        orientation: Orientation.Horizontal
      }
    }
  },
  {
    action: Action.USER_BILLING,
    label: "Billing",
    icon: "wallet",
    type: ActionType.MODAL,
    component: UserBilling,
    modalParams: {
      layout: {
        size: Size.lg,
        orientation: Orientation.Horizontal
      }
    }
  },
  {
    action: Action.USER_PLAN_CANCELATION,
    isMeta: true,
    type: ActionType.MODAL,
    component: UserPlanCancellation,
    modalParams: {
      layout: {
        size: Size.lg,
        orientation: Orientation.Vertical
      }
    }
  },
  {
    action: Action.BULK_LINK,
    type: ActionType.SEARCH_CMD,
    cmdLabel: "Link to a node or add to a collection",
    isMeta: true,
    searchActionParams: {
      searchCallback: async (search: string, componentParams?: any) => {
        const collectionResource = componentParams?.items?.[0]
          ? [determineResourceType(componentParams.items[0])]
          : [];
        return await queryLinkingSearchResults(search, {
          resource: componentParams?.resource,
          collectionResource:
            componentParams?.collectionResource ?? collectionResource
        });
      },
      placeholder: (componentParams?: any) => {
        return componentParams?.resource === Resource.collection
          ? "select a collection"
          : componentParams?.resource === Resource.node
            ? "select a node"
            : "select a node or a collection";
      },
      searchResultComponent: LinkSearchResultItem,
      callback: async (
        item: any,
        componentParams?: {
          multiSelectStore?: IMultiSelectStore;
          items?: IRecordId[];
        }
      ) => {
        try {
          const items =
            componentParams?.multiSelectStore?.get() ?? componentParams?.items;
          const context = componentParams?.multiSelectStore?.context;
          if (!items) {
            toasts.error(undefined, {
              closeProgressId: "bulklink"
            });
            return;
          }
          const resourceType = determineResourceType(item.id);
          toasts.showProgress(
            "bulklink",
            resourceType === Resource.collection
              ? "Adding to collection"
              : "Linking to node"
          );
          const result = await relateDatafnRecords({
            sourceIds: items,
            targetId: item.id,
            context: context?.accessPoint
          });
          logger.log({
            at: "bulkLink",
            id: item.id,
            resourceType,
            label: item.label,
            items,
            result
          });
          componentParams?.multiSelectStore?.reset();
          if (resourceType === Resource.collection) {
            toasts.success(
              `**${items.length}** ${
                items.length > 1 ? "items" : "item"
              } added to collection ${item.label ? `**${item.label}**` : ""}`,
              {
                closeProgressId: "bulklink"
              }
            );
          } else {
            toasts.success(
              `**${items.length}** ${
                items.length > 1 ? "items" : "item"
              } linked to node ${item.label ? `**${item.label}**` : ""}`,
              {
                closeProgressId: "bulklink"
              }
            );
          }
        } catch (e) {
          logger.error({ at: "bulkLink", error: e });
          toasts.error(undefined, {
            closeProgressId: "bulklink"
          });
        }
      }
    }
  },
  {
    action: Action.GLOBAL_SEARCH_MODAL,
    component: ResourceSearchModal,
    label: "Search",

    type: ActionType.RESOURCE,
    accessMode: AccessMode.POP,
    preCondition: () => {
      return view.get().isConstrainedWidth;
    },
    modalParams: {
      isShowOverlay: false,
      layout: {
        orientation: Orientation.Horizontal,
        size: Size.xl,
        ignoreSafeArea: true,
        isShowCantileverClose: true
      }
    }
  },
  {
    action: Action.SEARCH,
    component: ResourceSearchModal,
    label: "Search",
    icon: "search",
    type: ActionType.LIVE,
    accessMode: AccessMode.MAIN
  },
  {
    action: "appLoading",
    isMeta: true,
    label: "Test app loading",
    type: ActionType.PAGE,
    isMenuHidden: true,
    component: AppLoadingView,
    componentParams: {
      message: "First login detected. Copying data from database",
      subMessage: "Please wait...",
      duration: 50
    }
  },
  {
    action: "simpleDigitalClock",
    type: ActionType.PAGE,
    isMeta: true,
    component: SimpleDigitalClock
  },
  {
    action: "test",
    type: ActionType.PAGE,
    isMeta: true,
    component: Test
  },
  {
    action: "sampleCalendarItemThumbnail",
    type: ActionType.INLINE,
    isMeta: true,
    component: SampleCalendarItemThumbnail
  },
  {
    action: "focusTimelineEntry",
    type: ActionType.INLINE,
    isMeta: true,
    component: FocusCalendarEntryThumbnail
  },
  {
    action: Action.CALENDAR_DAY,
    type: ActionType.RESOURCE,
    isMeta: true,
    component: CalendarDayModal,
    modalParams: {
      title: "Day review",
      layout: {
        size: Size.xl,
        orientation: Orientation.Horizontal,
        isShowCantileverClose: true
      }
    }
  },
  {
    action: Action.HISTORY,
    label: "Activity",
    icon: "history",
    type: ActionType.RESOURCE,
    component: HistoryModal,
    modalParams: {
      title: "Activity",
      layout: {
        size: Size.lg,
        orientation: Orientation.Horizontal,
        isShowCantileverClose: true
      }
    }
  },
  {
    action: Action.DATA_SETTINGS,
    type: ActionType.MODAL,
    label: "Data Settings",
    icon: "database",
    component: DataSettings,
    hideContext: [Embed.HANDSET],
    modalParams: {
      title: "Data Settings",
      layout: {
        size: Size.lg,
        orientation: Orientation.Horizontal
      }
    }
  },
  {
    action: Action.CALENDAR_SETTINGS,
    type: ActionType.MODAL,
    label: "Calendar Settings",
    icon: "sliders",
    component: CalendarSettings,
    modalParams: {
      title: "Calendar Settings",
      layout: {
        size: Size.lg,
        orientation: Orientation.Horizontal,
        isShowCantileverClose: true
      }
    }
  },
  {
    action: ResourceActionType.BROWSE,
    component: ResourceBrowser,
    type: ActionType.FUNCTION,
    fn: async (params?: IActionFnParams) => {
      const resource = params?.componentParams?.resource;
      requireCommandHost().runAction(
        resourceAction(resource, ResourceActionType.BROWSE),
        {
          searchParams: {
            [AppSearchParam.RETURN_TO]:
              params?.componentParams?.[AppSearchParam.RETURN_TO] ?? "home"
          }
        }
      );
    }
  },
  {
    action: Action.OFFLINE_STATUS,
    type: ActionType.MODAL,
    component: OfflineStatusModal,
    modalParams: {
      layout: {
        size: Size.sm,
        isOveriddenFooter: true
      }
    }
  },
  {
    action: Action.NAVIGATOR,
    icon: "ph:compass-light",
    label: "Navigator",
    type: ActionType.LIVE,
    component: Navigator,
    accessMode: AccessMode.RIGHT,
    liveActionParams: {
      size: Size.sm
    }
  },
  {
    action: Action.TODAY,
    icon: "calendar-blank",
    label: "Today",
    type: ActionType.LIVE,
    component: Today,
    accessMode: AccessMode.RIGHT,
    liveActionParams: {
      size: Size.md
    }
  },
  {
    action: Action.RHOMBUS,
    icon: "proicons:rhombus",
    label: "Rhombus",
    type: ActionType.LIVE,
    component: ComingSoonView,
    accessMode: AccessMode.RIGHT,
    liveActionParams: {
      size: Size.md,
      isOpeningBehaviorConfigurable: true
    }
  }
];
