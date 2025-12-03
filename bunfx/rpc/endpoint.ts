import type { z } from "zod";

export type EndpointContext<TSchema extends z.ZodType> = {
	opts: z.infer<TSchema>;
};

export type EndpointDef<
	TSchema extends z.ZodType,
	TFn extends (ctx: EndpointContext<TSchema>) => Promise<unknown>,
> = {
	schema: TSchema;
	fn: TFn;
};

export type EndpointFn = ((opts: unknown) => Promise<unknown>) & {
	rpcDefinition: EndpointDef<
		z.ZodType,
		(ctx: { opts: unknown }) => Promise<unknown>
	>;
};

export function endpoint<
	TSchema extends z.ZodType,
	TFn extends (ctx: EndpointContext<TSchema>) => Promise<unknown>,
>(
	def: EndpointDef<TSchema, TFn>,
): (opts: z.infer<TSchema>) => Promise<Awaited<ReturnType<TFn>>> {
	const fn = (opts: z.infer<TSchema>) => def.fn({ opts });
	(fn as unknown as EndpointFn).rpcDefinition = def as EndpointDef<
		z.ZodType,
		(ctx: { opts: unknown }) => Promise<unknown>
	>;
	return fn as (opts: z.infer<TSchema>) => Promise<Awaited<ReturnType<TFn>>>;
}
