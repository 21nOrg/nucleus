import type { IButtonParams } from "@21n/elements/button/button.type";
import type { Size } from "@21n/elements/size.enum";

export type Toast = {
  id: string;
  type: AlertType;
  message?: string;
  title?: string;
  sound?: string;
  actionText?: string;
  callback?: () => void;
  isNonDismissable?: boolean;
  progress?: number;
};

export type ConfirmationNotification = {
  title: string;
  message: string;
  type?: AlertType;
  confirmAction?: IButtonParams;
  cancelAction?: IButtonParams;
  /**
   * if enabled, will show an input field for the user to enter this value
   */
  askInputConfirmation?: string;
  size?: Size;
};

export enum AlertType {
  SUCCESS = "SUCCESS",
  ERROR = "ERROR",
  WARNING = "WARNING",
  INFO = "INFO",
  PROGRESS = "PROGRESS"
}

export type IInlineStatus = {
  message: string;
  type: AlertType;
};

export type InlineToast = {
  id: string;
  type: AlertType;
  message: string;
  title?: string;
  data?: any;
};
