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
};

type Props = {
  routes: Record<string, () => Promise<RouteModule>>;
  children: ComponentChildren;
};

type LoadedPage = {
  type: "page";
  params: Record<string, string>;
  searchParams: Record<string, string>;
  url: URL;
  state: Signal<unknown>;
  Page: RouteModule["Page"];
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

async function loadRoute(routeState: Signal<RouteState>, navigate: NavigateFn) {
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
    const data = await mod.load?.(loaderArgs);
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
        state: signal(data),
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
      loadRoute(routeState, navigate);
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
  }, [router]);

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
