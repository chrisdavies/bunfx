export type RouteDefinitions<T> = Record<string, T>;
export type RouteMatch<T> = { pattern: string; value: T };
export type Router<T> = (pathname: string) => RouteMatch<T> | undefined;

type RouteChildren<T> = Record<string, RouteNode<T>>;
type RouteNode<T> = {
  children: RouteChildren<T>;
  match?: RouteMatch<T>;
};

function makeNode<T>(): RouteNode<T> {
  return { children: {} };
}

function routePieces(pattern: string) {
  return pattern.match(/[^\/]+/g) || [];
}

function buildTree<T>(tree: RouteNode<T>, pattern: string, value: T) {
  let node = tree;
  for (const piece of routePieces(pattern)) {
    const name = piece.startsWith('*') || piece.startsWith(':') ? piece.slice(0, 1) : piece;
    const child: RouteNode<T> = node.children[name] ?? makeNode<T>();
    node.children[name] = child;
    node = child;
  }
  node.match = { pattern, value };
}

function findMatch<T>(tree: undefined | RouteNode<T>, pieces: string[], index: number): RouteMatch<T> | undefined {
  const piece = pieces[index];
  if (!piece || !tree || index > pieces.length) {
    return tree?.match;
  }
  return findMatch(tree.children[piece], pieces, index + 1) ||
    findMatch(tree.children[':'], pieces, index + 1) ||
    tree.children['*']?.match;
}

export function makeRouter<T>(defs: RouteDefinitions<T>): Router<T> {
  const tree = makeNode<T>();
  for (const pattern in defs) {
    buildTree(tree, pattern, defs[pattern]);
  }
  return (pattern: string) => findMatch(tree, routePieces(pattern), 0);
}

export function makeRouteParams(opts: { pattern: string, pathname: string }) {
  const patternPieces = routePieces(opts.pattern);
  const components = routePieces(opts.pathname);
  const result: Record<string, string> = {};
  for (let i = 0; i < patternPieces.length; ++i) {
    const piece = patternPieces[i]!;
    if (piece[0] === ':') {
      result[piece.slice(1)] = decodeURIComponent(components[i] || '');
      continue;
    }
    if (piece[0] === '*') {
      result[piece.slice(1)] = components.slice(i).join('/');
      break;
    }
  }
  return result;
}
