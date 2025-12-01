import { makeRouteParams, makeRouter } from './core';

import { expect, test } from "bun:test";

test('makeRouter', () => {
  const tests: Array<[string, string]> = [
    ['hi/:name', 'hi/bob'],
    ['hi/:name', '/hi/albert'],
    ['hi/:name', 'hi/fred/'],
    ['hi/jim', 'hi/jim'],
    ['wild/*slug', 'wild/card/and/things'],
    ['hi/:name/comments/:id', 'hi/sam/comments/32'],
    ['hi/*slug', 'hi/sam/gamgee'],
  ];
  const route = makeRouter(tests.reduce((acc, arr) => {
    acc[arr[0]] = arr[0];
    return acc;
  }, {} as Record<string, string>));
  for (const [pattern, url] of tests) {
    const result = route(url);
    expect(result).toBeDefined();
    expect(result?.value).toBe(pattern);
  }

  expect(route('/no/such/thing')).toBeUndefined();
});

test('makeRouteParams', () => {
  expect(makeRouteParams({
    pattern: 'hi/:name/comments/:id',
    pathname: 'hi/fred/comments/42',
  })).toEqual({ name: 'fred', id: '42' });

  expect(makeRouteParams({
    pattern: 'hi/:name/comments/:id',
    pathname: `hi/${encodeURIComponent('Sam Gamgee')}/comments/hobbit`,
  })).toEqual({ name: 'Sam Gamgee', id: 'hobbit' });

  expect(makeRouteParams({
    pattern: 'hi/:name/*slug',
    pathname: 'hi/frodo/baggins/and/fellowship/',
  })).toEqual({ name: 'frodo', slug: 'baggins/and/fellowship' });
});
