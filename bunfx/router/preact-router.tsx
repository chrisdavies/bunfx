import { type Signal, signal } from "@preact/signals";
import { type ComponentChildren, createContext, type h } from "preact";
import { useContext, useEffect, useMemo } from "preact/hooks";
import { makeRouter, type Router } from "./core";

export type LoaderArgs = {
  params: Record<string, string>;
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
  state: Signal<unknown>;
  Page: RouteModule["Page"];
};

type ErrorPage = {
  type: "error";
  error: Error;
};

type LoadingRoute = {
  href: string;
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

async function loadRoute(routeState: Signal<RouteState>) {
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
    const data = await mod.load?.(route);
    if (loading !== routeState.value.loading) {
      return;
    }
    routeState.value = {
      ...routeState.value,
      loading: undefined,
      current: {
        type: "page",
        params: route.params,
        Page: mod.Page,
        state: signal(data),
      },
    };
  } catch (err) {
    console.error(err);
    if (loading !== routeState.value.loading) {
      return;
    }
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
    const goto = (href: string) => {
      const url = URL.parse(href, location.origin);
      if (!url) return;
      routeState.value = {
        ...routeState.value,
        loading: {
          href: url.href,
          pathname: url.pathname,
          search: url.search,
        },
      };
      loadRoute(routeState);
    };
    const onpopstate = () => goto(location.href);
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

export function PreactRouter(props: Props) {
  const routeState = useRouteStateProvider(props);
  return (
    <RouteContext.Provider value={routeState}>
      {props.children}
    </RouteContext.Provider>
  );
}
