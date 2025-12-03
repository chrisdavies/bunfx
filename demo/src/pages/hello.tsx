import type { LoaderArgs, PageArgs } from "bunfx";
import { makeRPCClient } from "bunfx/rpc/client";
import type { RPC } from "../server/rpc/types";

const rpc = makeRPCClient<RPC>();

export async function load(args: LoaderArgs) {
	const token = await rpc.tokens.generateToken({
		prefix: args.params.name,
		length: 12,
	});

	return {
		name: args.params.name,
		greeting: `Hello, ${args.params.name}!`,
		token,
		timestamp: Date.now(),
	};
}

export function Page(props: PageArgs<typeof load>) {
	const { greeting, token, timestamp } = props.state.value;
	return (
		<div>
			<h1>{greeting}</h1>
			<p>Your token: {token}</p>
			<p>Loaded at: {new Date(timestamp).toLocaleTimeString()}</p>
			<footer>
				<a href="/">Home</a>
			</footer>
		</div>
	);
}
