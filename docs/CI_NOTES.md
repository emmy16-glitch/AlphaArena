# CI notes

AlphaArena intentionally installs frontend dependencies with `npm install` in CI because this hackathon repository currently does not commit a lockfile. `actions/setup-node` npm caching is also intentionally disabled until a lockfile is committed; setup-node's npm cache requires a dependency lock path.

The browser matrix uses one Playwright engine installation per job to reduce unnecessary runner work while still validating all seven declared projects.

A failing browser job uploads its trace/screenshot/video evidence. Do not merge the release candidate while any matrix project is red.

## Minimal-host browser dependencies

`package.json` requires Node `>=20.19.0` (Playwright requirement). On minimal hosts without passwordless sudo, `npx playwright install --with-deps` cannot install OS libraries. The verified user-level workaround is:

1. Install Node with nvm (never replace the system Node).
2. `npx playwright install chromium firefox webkit` (browser binaries need no root).
3. For each library the launcher reports missing, `apt-get download <package>` (no sudo needed) and extract with `dpkg-deb -x <deb> <dir>`, then run tests with `LD_LIBRARY_PATH=<dir>/usr/lib/x86_64-linux-gnu`.
4. WebKit's `minibrowser-wpe/MiniBrowser` wrapper overwrites `LD_LIBRARY_PATH`, so symlink the extracted `.so` files into `~/.cache/ms-playwright/webkit-*/minibrowser-wpe/lib/` instead.
5. Run with `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` only on such minimal hosts; CI runners keep full validation via `install-deps`.
