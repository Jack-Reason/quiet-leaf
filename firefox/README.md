# Firefox through Violentmonkey

Firefox package **0.6.5**, generated from the Safari 0.6.5 reader. One generated file serves desktop Firefox and Android Firefox. macOS installation and the automated stand-in are in [macos/README.md](macos/README.md). Firefox on iPad has no install route; the blocker is in [ipad/README.md](ipad/README.md).

Issue [#2](https://github.com/Jack-Reason/quiet-leaf/issues/2) is closed. The remaining Android item was physical-device testing, and that requirement was dropped. No physical Android device, physical Mac, or authenticated Archive loan has been verified for this package. Desktop Gecko fixtures are not an Android or macOS device result.

## Install on Android for testing

1. In **Firefox for Android**, install [Violentmonkey from Mozilla Add-ons](https://addons.mozilla.org/android/addon/violentmonkey/). Mozilla documents the [Android extension installation flow](https://support.mozilla.org/en-US/kb/find-and-install-add-ons-firefox-android). This route does not apply to Firefox on iPad.
2. Open the [Firefox userscript](https://raw.githubusercontent.com/Jack-Reason/quiet-leaf/main/firefox/Quiet-Leaf-Firefox.user.js) in that Firefox browser, then accept Violentmonkey's installation prompt. If Firefox shows the source instead, copy its URL and use **Violentmonkey → dashboard → + → Install from URL**. Confirm that the script is named **Quiet Leaf — Internet Archive (Firefox)**, version **0.6.5**, and enabled. The checked-in file is also available as [Quiet-Leaf-Firefox.user.js](Quiet-Leaf-Firefox.user.js). macOS uses the same file; see [macos/README.md](macos/README.md).
3. Disable any other Quiet Leaf script in this browser, so only one version runs. Reload an Archive book. Keep Violentmonkey's injection setting at **content**, as specified by this script; do not force page injection or disable the site's content security policy.
4. Wait for Archive's own scan to appear, then tap **Read quietly · Firefox 0.6.5**. For restricted books, sign in and borrow through Archive first.
5. Tap **⋯** for controls. Choose **Reading → Continuous scroll** or **Single page**. In single-page mode, the left sixth turns back and the rest turns forward. In scroll mode, swipe vertically. Long-press words for Android's native selection menu when Archive supplies a text layer. A short two-finger tap also toggles controls.
6. [DEVICE-TESTING.md](DEVICE-TESTING.md) is the historical Android record. Physical-device testing was dropped with issue #2, so that checklist is not a merge gate for 0.6.5. Include the book URL and scan number for any failure; do not share session cookies or loan tokens.

The install URL tracks the default branch. Review the version when updating; disable automatic script updates in Violentmonkey if you need to hold a particular test version. To remove it, disable/delete the Firefox entry in Violentmonkey and reload the book. The Safari script and Safari's Userscripts folder are independent. Existing progress in this Firefox profile uses the same per-volume keys; uninstalling the script does not clear Archive site data.

If the launcher is missing, check that Violentmonkey and the script are enabled for `https://archive.org/details/…` or `/stream/…`, then reload the top-level book page. The script deliberately does not run in embedded frames or on unrelated sites. If a scan fails, use Retry or Back to Archive to complete the normal access/loan flow.

## Firefox integration

`Quiet-Leaf-Firefox.user.js` is a self-contained generated install file. `build.cjs` reads the root Safari source and `adapter.js`, checks each replacement hook, and adds only the Firefox integration and platform wording. There are no runtime downloads or `@require` dependencies. Do not edit the generated file by hand. The root Safari install file is unchanged.

The package explicitly uses Violentmonkey's **content** injection mode with `@grant none`. It works through DOM controls rather than calling Archive's private BookReader JavaScript. Firefox's extension isolation needs extra care for object-valued DOM events: the bookmark fallback constructs its numeric payload in the page's object realm, and the page-change listener unwraps only the event detail and accepts a nonnegative safe-integer index. No function or extension API is exported. See [Violentmonkey's execution contexts](https://violentmonkey.github.io/posts/inject-into-context/) and Mozilla's [object sharing](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Sharing_objects_with_page_scripts) and [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent) documentation.

The real-manager regression reproduces `Permission denied to access property "bookmark"` with the unmodified Safari 0.6.5 script, leaving a remote resume at scan 7 stuck at scan 0. The Firefox package passes the same scenario. Bookmark payloads are created with the page realm’s `Object`, and page-change indexes are read across Firefox’s extension boundary. This is a desktop Firefox result.

Native slider keyboard navigation, access checks, image loading, progress rules, manual-bookmark preservation, fullscreen exit behavior, memory limits, the text-layer allowlist, failed-leaf retry, focus trap, and the 0.6.4 release of a touch that ends outside the page come from the shared 0.6.5 source. Scans are copied from Archive's already-loaded images into memory; there is no token extraction, access bypass, bulk download, or artificial idle activity. Firefox's native word-selection menu and fullscreen prompt are outside these fixtures; the script cannot choose the OS menu's actions.

## Development and automated checks

From the repository root, install the pinned dependencies with `npm ci`. Use a Node release compatible with jsdom (the checked-in lockfile currently requires Node 22.22.2+, 24.15+, or 26+).

```sh
npm run build:firefox
npm run check:firefox
npm run test:firefox
npm test
npx playwright install chromium firefox webkit
npm run test:layout
npm run test:scroll
npm run test:startup
npm run test:gulag
npm run test:firefox:browser
```

`test:firefox` checks package freshness and the adapter's cross-realm payload/index handling. `test:firefox:browser` runs the existing DOM, layout, continuous-scroll, startup/fullscreen, and all three Gulag-volume fixtures against the generated package in desktop Playwright Firefox. These are controlled fixtures: scripts are loaded into the page for the rendering suites, and neither Android touch UI nor a genuine loan is exercised. `QL_ENGINE=firefox` and `QL_SOURCE=firefox/Quiet-Leaf-Firefox.user.js` can also select individual shared suites. The original default engines and Safari source remain the defaults.

For actual desktop **Violentmonkey injection and extension isolation**, also run:

```sh
QL_GECKODRIVER=/absolute/path/to/geckodriver \
QL_VIOLENTMONKEY_XPI=/absolute/path/to/violentmonkey.xpi \
npm run test:firefox:manager
```

Download [geckodriver from Mozilla](https://github.com/mozilla/geckodriver/releases) and the signed Violentmonkey XPI from its [Mozilla Add-ons listing](https://addons.mozilla.org/firefox/addon/violentmonkey/). This test also needs `openssl` and `unzip` on PATH. It uses the installed Playwright Firefox binary unless `QL_FIREFOX_BINARY` selects another local Firefox executable. It prints the tested browser/manager versions and XPI SHA256. The recorded run used Playwright Firefox 141.0, geckodriver 0.37.1 and Violentmonkey 2.50.0.

The manager suite creates a disposable WebDriver profile, loads the real XPI and imports the package through Violentmonkey's parser. A local HTTPS proxy serves a fake Archive origin and bookmark service, with CSP enforced and a synthetic HttpOnly session cookie. No fixture traffic reaches the real Archive service. It checks automatic injection, the bookmark fallback and inbound page event across the extension boundary, cookie retention, blue bookmarks, reload/resume, slider events, synthetic touch zones, scroll prefetch, final-page bounds and text-layer copying. Its self-signed test certificate is accepted only in that disposable profile; no system certificate or browser setting is changed. The profile, proxy and certificate are cleaned up. This still does not test the Android install UI, physical gestures, real Archive access or loan renewal.

For before/after diagnosis, `QL_SOURCE=Quiet-Leaf.user.js` with the same manager command intentionally fails the bookmark-fallback resume scenario on the Safari 0.6.5 file.

Automated results are recorded in [macos/README.md](macos/README.md) and the historical Android notes in [DEVICE-TESTING.md](DEVICE-TESTING.md). Passing desktop Gecko or a narrow viewport is not Android Firefox support and is not Firefox on iPad. macOS Firefox’s install route is the Violentmonkey package above, with Playwright Firefox as the stand-in where a physical Mac is not used. iPad Firefox remains unavailable ([ipad/README.md](ipad/README.md)).
