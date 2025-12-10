import type { RouteModule } from "bunfx";

export type RouteDefinitions = Record<string, () => Promise<RouteModule>>;

export const routes: RouteDefinitions = {
  "": () => import("./home"),
  login: () => import("./login"),
  verify: () => import("./verify"),
  "s/:id": () => import("./secret"),
  "*slug": () => import("./not-found"),
};
