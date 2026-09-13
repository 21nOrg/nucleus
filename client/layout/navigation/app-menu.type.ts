export type IAppMenuStore = {
  [key: string]: Menu;
};
type Menu = {
  default: string[];
  mobile: string[];
  user: string[];
};
