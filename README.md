# bunfx

A low-dependency web application framework for Bun, built with Claude Code.

## More AI slop? Hard pass.

Well, this is an experiment [see the full writeup](./blog/2025-12-11-claude-and-bun.md).

## Structure

This is a monorepo with two packages:

- **[bunfx](./bunfx)** - Framework utilities: routing, database, sessions, migrations, RPC, logging
- **[secrets-share](./secrets-share)** - Example app demonstrating encrypted, self-destructing secret sharing

## Getting started

```bash
bun install
```

### Run the example app

```bash
cd secrets-share
bun dev
```

### Run checks

```bash
bun check
```

