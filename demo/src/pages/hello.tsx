import type { LoaderArgs, PageArgs } from "bunfx";

export async function load(args: LoaderArgs) {
	// Simulate fetching data
	return {
		name: args.params.name,
		greeting: `Hello, ${args.params.name}!`,
		timestamp: Date.now(),
	};
}

export function Page(props: PageArgs<typeof load>) {
	const { greeting, timestamp } = props.state.value;
	return (
		<div>
			<h1>{greeting}</h1>
			<p>Loaded at: {new Date(timestamp).toLocaleTimeString()}</p>
			<footer>
				<a href="/">Home</a>
			</footer>
		</div>
	);
}
