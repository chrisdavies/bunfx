import { PreactRouter, useRouteState } from "bunfx";
import { render } from "preact";
import { routes } from "./pages";

function CurrentPage() {
	const { current } = useRouteState().value;
	if (!current) {
		return null;
	}
	if (current.type === "page") {
		const { Page, ...props } = current;
		return <Page {...props} />;
	}
	if (current.type === "error") {
		return (
			<div class="p-8">
				<h1 class="text-red-600 text-2xl">Error</h1>
				<p>{current.error.toString()}</p>
			</div>
		);
	}
	return null;
}

function PageLoadingIndicator() {
	const routeState = useRouteState().value;
	if (!routeState.loading) {
		return null;
	}
	return <div class="page-loading-indicator"></div>;
}

function App() {
	return (
		<PreactRouter routes={routes}>
			<PageLoadingIndicator />
			<CurrentPage />
		</PreactRouter>
	);
}

function start() {
	render(<App />, document.querySelector("main") || document.body);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", start);
} else {
	start();
}
