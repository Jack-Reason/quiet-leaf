# macOS Firefox

Quiet Leaf **0.6.5** on macOS Firefox uses the generated package [`../Quiet-Leaf-Firefox.user.js`](../Quiet-Leaf-Firefox.user.js). It is the same file as the Android package, rebuilt from `Quiet-Leaf.user.js` plus `firefox/adapter.js`. Violentmonkey injects it in the **content** context with `@grant none`. The Safari install file and the Userscripts folder stay separate.

No physical Mac was used for 0.6.5. Playwright Firefox on Linux is the stand-in for the manual macOS checks. The versions below are the ones that actually ran.

## Install on macOS

1. Install Firefox for macOS from [mozilla.org](https://www.mozilla.org/firefox/).
2. Install [Violentmonkey](https://addons.mozilla.org/firefox/addon/violentmonkey/) from Mozilla Add-ons. The package was exercised with Violentmonkey **2.50.0**.
3. Open the [Firefox userscript](https://raw.githubusercontent.com/Jack-Reason/quiet-leaf/main/firefox/Quiet-Leaf-Firefox.user.js) and accept Violentmonkey’s install prompt. If Firefox shows the source, copy the URL and use **Violentmonkey → dashboard → + → Install from URL**. Confirm the name **Quiet Leaf — Internet Archive (Firefox)**, version **0.6.5**, and injection **content**. Leave the site content-security policy enabled.
4. Disable any other Quiet Leaf script in this profile. Keep a single copy.
5. Open an Archive book, wait for Archive’s own scan, then choose **Read quietly · Firefox 0.6.5**. Sign in and borrow through Archive when the book requires it.
6. Open controls with **⋯** or a short two-finger trackpad tap. In single-page mode the left sixth of the screen goes back and the rest goes forward. In continuous scroll, use the trackpad or mouse wheel. Arrow keys turn pages. Escape closes the reader and returns focus to **Read quietly**.

The install URL tracks the default branch. Disable automatic updates in Violentmonkey to hold a specific version. Removing the Firefox entry does not clear Archive site data. Progress keys are per volume in this Firefox profile.

## Automated stand-in

Recorded on **Ubuntu 24.04.5 LTS**, Node **22.23.4**, npm **10.9.9**, Playwright **1.55.1**.

| Check | Firefox / tooling | What it stands in for |
| --- | --- | --- |
| `npm test` | jsdom plus the Firefox adapter | Shared reader behaviour, page-realm bookmark payloads, rejected page-change indexes |
| `npm run test:layout` | Chromium 140.0.7339.186 | Word geometry. The same fixture reruns under Firefox via `test:firefox:browser` |
| `npm run test:scroll`, `test:startup`, `test:gulag` | Chromium 140.0.7339.186 and Playwright WebKit 26.0 | Both reading modes, prefetch, resume, three Gulag volume bounds, right-to-left slider keys |
| `npm run test:origin` | Chromium, Firefox 141.0 and WebKit 26.0 at 1024×1366 | Cross-origin scan copy |
| `npm run test:firefox:browser` | Playwright Firefox **141.0** | The generated 0.6.5 package: navigation, keyboard and pointer controls, both modes, text geometry, bookmarks, resume, failed-page recovery, Gulag volumes, final bounds, RTL slider |
| `npm run test:firefox:manager` | Firefox **141.0**, geckodriver **0.37.1**, Violentmonkey **2.50.0** | Real content-script injection, the bookmark-fallback permission boundary, session cookie, blue bookmarks, reload/resume |

Violentmonkey XPI SHA256 for this run: `5e074465c7fdd31934e5b4664e3d2eac54269df575a0c0db52c843fe9afd81df`.

A macOS version, a physical trackpad, and a signed-in Archive account were not part of the run. Pointer, wheel and keyboard coverage uses the fixture’s DOM events. The manager suite sends bookmark requests to a local stand-in with a synthetic HttpOnly cookie; it does not open a loan, renew one, or exercise the macOS text-selection menu or Firefox’s fullscreen prompt. Those limits are the same ones named in the repository README.

Commands and dependency setup for the manager suite are in [../README.md](../README.md). `QL_SOURCE=Quiet-Leaf.user.js` with that command still fails the scan-7 resume with `Permission denied to access property "bookmark"`. The generated package passes it.
