import { expect, test } from "bun:test";
import { makeRouter } from "./core";

test("makeRouter", () => {
	const tests: Array<[string, string, Record<string, string>]> = [
		["hi/:name", "hi/bob", { name: "bob" }],
		["hi/:name", "/hi/albert", { name: "albert" }],
		["hi/:name", "hi/fred/", { name: "fred" }],
		["hi/:name", "hi/sam%20gamgee/", { name: "sam gamgee" }],
		["hi/jim", "hi/jim", {}],
		["wild/*slug", "wild/card/and/things", { slug: "card/and/things" }],
		["hi/:name/comments/:id", "hi/sam/comments/32", { name: "sam", id: "32" }],
		["hi/*slug", "hi/sam/gamgee", { slug: "sam/gamgee" }],
		["*slug", "what/evz", { slug: "what/evz" }],
		["*slug", "", { slug: "" }],
	];
	const route = makeRouter(
		tests.reduce(
			(acc, arr) => {
				acc[arr[0]] = arr[0];
				return acc;
			},
			{} as Record<string, string>,
		),
	);
	for (const [pattern, pathname, params] of tests) {
		const result = route(pathname);
		expect(result).toBeDefined();
		expect(result?.value).toBe(pattern);
		expect(result?.params).toEqual(params);
	}
});
