# CI notes

AlphaArena intentionally installs frontend dependencies with `npm install` in CI because this hackathon repository currently does not commit a lockfile. `actions/setup-node` npm caching is also intentionally disabled until a lockfile is committed; setup-node's npm cache requires a dependency lock path.

The browser matrix uses one Playwright engine installation per job to reduce unnecessary runner work while still validating all seven declared projects.

A failing browser job uploads its trace/screenshot/video evidence. Do not merge the release candidate while any matrix project is red.
