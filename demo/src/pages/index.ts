import type { RouteModule } from "bunfx";

export type RouteDefinitions = Record<string, () => Promise<RouteModule>>;

export const routes: RouteDefinitions = {
	"": () => import("./home"),
	"hi/:name": () => import("./hello"),
	"*slug": () => import("./not-found"),
};
