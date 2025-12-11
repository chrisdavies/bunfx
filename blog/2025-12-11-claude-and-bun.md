# Claude and Bun

I thought of this project after the Nth npm-related vulnerability. How realistic is it to build a low-dependency application, using Claude to generate code that you would normally pull in from npm?

I also wanted to do a deeper assessment of building something realistic in Bun.

## Replacing npm with Claude Code

Most of the code in this project was written by Claude Code (Opus 4.5). I didn't review any of the tests or markdown files. I *did* however review the generated source code. For ipmortant files, my reviews were more careful for unimportant files (e.g. CSS), I just did a quick scan.

Claude was OK. Not excellent; just OK. Most of the time, its first solution was almost good enough. It went wrong in various ways. It tended to be overly verbose or inefficient in surpringly stupid ways. It sometimes solved problems by littering a module with effectful global mutatable state. It often generated code which was quite different in style from other code in the project.

I'm sure the problems were exacerbated this project's lack of a claude.md file (or whatever the latest equivalent is).

That said, TypeScript and Biome helped guide things to a mostly consistent place faster than if I'd written all of this myself. The total effort I exerted to build this project was lower than if I'd built it myself.

## Is it more secure than npm?

Maybe, maybe not. I have no doubt an astute security expert could find vulnerabilities in this codebase. There are certainly fewer eyes on this than on a popular npm package. On the other hand, the code that is committed here gets reviewed rather than blindly pulled and updated (as is the case with every npm-based project I've ever been a part of).

## Benefits of DIY w/ Claude

With Claude, you can build a set of tools that fit you and your application. With npm, you end up cobbling together a bunch of disparate libraries, each with a distinct style and flavor, some of which are unpleasant.

With Claude, you build what you need. With npm, you are likely to pull in an overly general library that gives you the function you want along with 10 you don't.

## Is it faster than npm?

No. Maybe? This project took quite a while to build. About half of that time was iterating on architecture / API design, and half was code-review and providing feedback to Claude.

However, now that the foundation is built, maybe it will be faster moving forward. I may build another demo project on top of this, and see how that goes.

## Bun's SQL limitations

Let's move on to Bun.

So far, buliding on top of Bun has been excellent with on caveat.

Bun's SQL layer is decent, but comes with a few drawbacks:

- No logging support
- No transform support (e.g. no equivalent to Postgres.js `transform: toCamel`)
- No support for streaming large resultsets

The first two aren't showstoppers. They're annoying, and require a bit more care when querying data. But the lack of streaming does make certain applications very difficult to write.

