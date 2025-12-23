import { type Signal, signal } from "@preact/signals";
import { type ComponentChildren, createContext, type h } from "preact";
import { useContext, useEffect, useMemo } from "preact/hooks";
import { ClientError } from "../rpc/error";
import { makeRouter, type Router } from "./core";
import { RedirectError } from "./redirect";

export type LoaderArgs = {
  params: Record<string, string>;
  searchParams: Record<string, string>;
  url: URL;
};

export type PageArgs<T extends (args: LoaderArgs) => Promise<unknown> = never> =
  LoaderArgs & {
    state: Signal<[T] extends [never] ? undefined : Awaited<ReturnType<T>>>;
  };

type AnyLoaderFn = (args: LoaderArgs) => Promise<unknown>;

export type RouteModule = {
  load?(props: LoaderArgs): Promise<unknown>;
  Page(props: PageArgs<AnyLoaderFn>): null | h.JSX.Element;
  /**
   * Optional function to compute a key for this route.
   * When the key changes, the page component is remounted (all local state resets).
   *
   * Default: full URL (pathname + search) - remounts on any URL change.
   *
   * Return a stable value to prevent remounting:
   * - `() => "stable"` - never remount
   * - `({ params }) => params.orgId` - only remount when orgId changes
   */
  key?(props: LoaderArgs): string;
};

type Props = {
  routes: Record<string, () => Promise<RouteModule>>;
  children: ComponentChildren;
  /**
   * Route to render (in place, without changing URL) when a loader throws a 404 error.
   * Example: "/not-found"
   */
  notFoundRoute?: string;
  /**
   * Route to redirect to when a loader throws a 401 error.
   * The current path will be appended as a `returnTo` query parameter.
   * Example: "/login"
   */
  loginRoute?: string;
};

type LoadedPage = {
  type: "page";
  params: Record<string, string>;
  searchParams: Record<string, string>;
  url: URL;
  state: Signal<unknown>;
  Page: RouteModule["Page"];
  key: string;
};

type ErrorPage = {
  type: "error";
  error: Error;
};

type LoadingRoute = {
  url: URL;
  pathname: string;
  search: string;
};

type RouteState = {
  loading?: LoadingRoute;
  router: Router<() => Promise<RouteModule>>;
  current?: LoadedPage | ErrorPage;
};

const RouteContext = createContext<Signal<RouteState>>(
  signal({ router: makeRouter({}) }),
);

type NavigateFn = (opts: { href: string; push: boolean }) => void;

function getRedirectUrl(err: unknown): string | undefined {
  if (err instanceof RedirectError) {
    return err.href;
  }
  if (err instanceof ClientError && err.code === "redirect") {
    const data = err.data as { redirectUrl?: string } | undefined;
    return data?.redirectUrl;
  }
}

type ErrorRouteConfig = {
  notFoundRoute?: string;
  loginRoute?: string;
};

async function loadRoute(
  routeState: Signal<RouteState>,
  navigate: NavigateFn,
  errorConfig: ErrorRouteConfig,
) {
  const state = routeState.peek();
  const loading = state.loading;
  if (!loading) {
    return;
  }
  try {
    const route = state.router(loading.pathname);
    if (!route) {
      return;
    }
    const mod = await route.value();
    const searchParams: Record<string, string> = {};
    for (const [key, value] of loading.url.searchParams) {
      if (!(key in searchParams)) {
        searchParams[key] = value;
      }
    }
    const loaderArgs: LoaderArgs = {
      params: route.params,
      searchParams,
      url: loading.url,
    };

    // Compute key before calling load - if key matches current page, skip load
    const defaultKey = loading.url.pathname + loading.url.search;
    const pageKey = mod.key?.(loaderArgs) ?? defaultKey;
    const currentPage = state.current;
    const keyMatches =
      currentPage?.type === "page" && currentPage.key === pageKey;

    // If key matches, reuse existing state signal (skip load)
    // Otherwise, call load and create new state
    const pageState = keyMatches
      ? currentPage.state
      : signal(await mod.load?.(loaderArgs));

    if (loading !== routeState.value.loading) {
      return;
    }
    routeState.value = {
      ...routeState.value,
      loading: undefined,
      current: {
        type: "page",
        params: route.params,
        searchParams,
        url: loading.url,
        Page: mod.Page,
        state: pageState,
        key: pageKey,
      },
    };
  } catch (err) {
    if (loading !== routeState.value.loading) {
      return;
    }

    // Handle redirects
    const redirectUrl = getRedirectUrl(err);
    if (redirectUrl) {
      navigate({ href: redirectUrl, push: true });
      return;
    }

    // Handle 401 Unauthorized - redirect to login with returnTo
    if (
      err instanceof ClientError &&
      err.status === 401 &&
      errorConfig.loginRoute
    ) {
      const returnTo = encodeURIComponent(
        loading.url.pathname + loading.url.search,
      );
      navigate({ href: `${errorConfig.loginRoute}?returnTo=${returnTo}`, push: true });
      return;
    }

    // Handle 404 Not Found - render notFoundRoute in place (keep URL unchanged)
    if (
      err instanceof ClientError &&
      err.status === 404 &&
      errorConfig.notFoundRoute
    ) {
      const notFoundRouteMatch = state.router(errorConfig.notFoundRoute);
      if (notFoundRouteMatch) {
        try {
          const notFoundMod = await notFoundRouteMatch.value();
          routeState.value = {
            ...routeState.value,
            loading: undefined,
            current: {
              type: "page",
              params: {},
              searchParams: {},
              url: loading.url, // Keep original URL
              Page: notFoundMod.Page,
              state: signal(undefined),
              key: "not-found",
            },
          };
          return;
        } catch {
          // Fall through to error state if notFoundRoute fails to load
        }
      }
    }

    console.error(err);
    const error = err instanceof Error ? err : new Error(err?.toString());
    routeState.value = {
      ...routeState.value,
      loading: undefined,
      current: { type: "error", error },
    };
  }
}

function useRouteStateProvider(props: Props) {
  const router = useMemo(() => makeRouter(props.routes), [props.routes]);
  const routeState = useMemo(() => {
    return signal<RouteState>({ router });
  }, [router]);
  const errorConfig: ErrorRouteConfig = useMemo(
    () => ({
      notFoundRoute: props.notFoundRoute,
      loginRoute: props.loginRoute,
    }),
    [props.notFoundRoute, props.loginRoute],
  );

  useEffect(() => {
    const navigate = ({ href, push }: { href: string; push: boolean }) => {
      const url = URL.parse(href, location.origin);
      if (!url) return;
      if (push) {
        history.pushState(null, "", href);
      }
      routeState.value = {
        ...routeState.value,
        loading: {
          url,
          pathname: url.pathname,
          search: url.search,
        },
      };
      loadRoute(routeState, navigate, errorConfig);
    };
    const goto = (href: string) => navigate({ href, push: true });
    const onpopstate = () => navigate({ href: location.href, push: false });
    const onclick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest?.<HTMLAnchorElement>(
        "a[href]",
      );
      if (!anchor) {
        return;
      }

      if (
        !anchor.download &&
        !anchor.dataset?.noroute &&
        !anchor.target &&
        !anchor.href.startsWith("mailto:") &&
        (!/^https?:\/\//.test(anchor.href) ||
          anchor.href.startsWith(location.origin)) &&
        !anchor.closest("[contenteditable]")
      ) {
        // Let the browser do its default behavior
        // and open the link in a new tab when users CTRL+Click
        if (e.metaKey || e.ctrlKey) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        goto(anchor.href);
      }
    };
    window.addEventListener("popstate", onpopstate);
    document.addEventListener("click", onclick);
    onpopstate();
    return () => {
      window.removeEventListener("popstate", onpopstate);
      document.removeEventListener("click", onclick);
    };
  }, [router, errorConfig]);

  return routeState;
}

export function useRouteState() {
  return useContext(RouteContext);
}

/**
 * Programmatically navigate to a URL. Works like clicking a link.
 */
export function navigateTo(href: string) {
  history.pushState(null, "", href);
  dispatchEvent(new PopStateEvent("popstate"));
}

export function PreactRouter(props: Props) {
  const routeState = useRouteStateProvider(props);
  return (
    <RouteContext.Provider value={routeState}>
      {props.children}
    </RouteContext.Provider>
  );
}
