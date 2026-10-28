# Quiet Leaf 0.6.3

Original scanned pages, a black backdrop, and a discreet controls button. Choose single-page reading or continuous vertical scrolling. For Internet Archive in iPad Safari through the Userscripts extension.

## Gulag Archipelago loading fix (0.6.3)

Continuous reading now selects exact scans through Archive’s native slider keyboard handler. It no longer resizes the slider and synthesizes a mouse click at a fractional pixel coordinate. The old approach could select the previous scan and leave Quiet Leaf waiting for a page that was never requested. Tests reproduce the 0.6.2 failure at `n9 → n10` using the Gulag volume-one page range; the replacement passes that transition.

The adapter prefers the visible slider, recognises `/page/n…` URLs as well as hash URLs, and supports Archive’s current page-change event index. It corrects a missed native jump at most twice, and distinguishes navigation failures from image-load failures. Volume-specific progress uses Archive’s `subPrefix`, with the volume URL as a fallback when configuration is unavailable. End-of-volume bounds prevent nonexistent scan placeholders.

A small **⋯** button at the top right opens the controls with a mouse or trackpad as well as touch. Mac Safari no longer requires a two-finger touch gesture. The original two-finger and keyboard shortcuts remain available.

For this three-volume item, use **Back to Archive → Viewable files** to choose another volume, then **Read quietly**. Progress is separate for each volume; this release does not concatenate the three PDFs into one scroll strip.

## Update

Replace `Quiet-Leaf.user.js` in your selected Userscripts folder with this file. Keep only one copy. Open Safari’s Userscripts popup once, then reload the book. The launcher reads **Read quietly · 0.6.3**.

If an older version has left a tab stuck, close it and open the book again after replacing the script.

## Install from scratch

1. Install [Userscripts by Justin Wasack](https://apps.apple.com/us/app/userscripts/id1463298887).
2. Open Userscripts and select its scripts folder.
3. Save `Quiet-Leaf.user.js` in that folder.
4. Enable Userscripts in Safari and allow it on archive.org.
5. Open its popup once and reload the Archive book. Sign in and borrow when the book requires it; open-access books can be read without borrowing.
6. Wait for the scan to appear, then tap **Read quietly**.

## Controls

- In Single page mode, tap the left sixth of the screen: previous page.
- In Single page mode, tap the remaining five sixths: next page.
- In Continuous scroll mode, swipe vertically or scroll with a trackpad/mouse; single taps do not turn pages.
- Tap **⋯** or use a two-finger tap, then choose **Reading → Continuous scroll** or **Single page**. Your choice is remembered per book.
- Tap with two fingers together: reveal or hide controls.
- Touch and hold a word: select it using Safari’s native text-selection menu. Available actions (Look Up, Search, Translate, and others) are controlled by iPadOS.
- **Blue bookmark**: save a native Archive bookmark for the displayed scan.
- **Return to farthest**: jump to your saved progress.
- **Set progress here**: after confirmation, reset your farthest position to the displayed page.
- **Sync now**: retry saving progress to Archive.
- **Full screen**: request Safari fullscreen. If unavailable, fill the browser viewport.
- **Back to Archive**: close Quiet Leaf. Safari’s fullscreen exit (×) leaves Quiet Leaf open in the browser viewport; use Back to Archive or Escape to close the reader.
- Keyboard arrows turn pages; Escape closes; Space reveals controls when the reader has focus.

Single-page mode fits the entire scan proportionally; Continuous scroll fits each scan to the viewport width. Neither crops the image. Colour treatment is selectable. Rotate the iPad and it refits. Black fills any aspect-ratio mismatch.

## Startup and fullscreen fixes in 0.6.2

Opening away from the saved red progress marker now waits for Archive’s asynchronous one-page-view initialization before requesting that marker. Archive’s initialization can schedule a later jump to the page that was open originally; the two jumps must not compete. Progress stays guarded until the requested resume scan actually displays. A failed restore offers Retry or Back to Archive and never silently falls back to counting the activation page as newly read.

Leaving Safari fullscreen changes only presentation. Quiet Leaf keeps its overlay, pending page loads, scroll strip and progress intact. This prevents native navigation or fullscreen-ending gestures from tearing down the reader during backward scrolling or resume. To close Quiet Leaf, use Back to Archive or Escape. Safari controls whether the browser itself stays fullscreen; the script does not force fullscreen back on without a user gesture.

The startup regression fixture covers activation before and after the saved marker, delayed native mode initialization, backward reading, loss of standard/WebKit fullscreen state, and preserved farthest progress in both reading modes. Actual iPad gestures and authenticated loans still require on-device verification.

## Continuous scroll in 0.6.0

Pages form one vertical strip with narrow black separators. Each scan fits the full available width and retains its proportions. Tall pages extend below the screen; swipe to continue. Rotation refits the scans while preserving your position within the current page. The standard iPad scrolling gestures remain available, alongside native long-press word selection and two-finger reader controls. Arrow Up/Down and Page Up/Down scroll; Left/Right jump to an adjacent page.

The red farthest-progress bookmark advances only after a loaded page reaches the reading line, one quarter down the screen (capped at 200 pixels). Scans prefetched beneath your current reading position are not marked visited. Blue bookmarks and Set progress here refer to the page at that reading line. Missing scans cannot advance progress. Scrolling backward never reduces the farthest marker unless you explicitly use Set progress here. Read quietly and Return to farthest resume at the top of that saved page.

Only nearby scans are loaded, using Archive’s native page selection and normal loan/access checks. Previously visited pages keep placeholders of the same size; their scan/text contents are released when far away and reloaded when you return. This limits image memory without removing your scroll history. On a slow connection you may briefly reach a loading placeholder. Retry keeps the strip in place; closing the reader cancels pending display work. Prefetching a neighbouring leaf selects it through Archive’s page slider. BookReader emits `BookReader:userAction` on every visible leaf change, including that slider prefetch. That reading activity is accepted behaviour. The prefetched scan is not marked visited, and Quiet Leaf does not emit a second activity event when BookReader has already sent one.

Paper appearance, contrast, brightness, word lookup and the existing bookmark logic work in both modes. Mode switches keep the current reading page; the two modes share the same saved farthest bookmark. Continuous scroll retains progress by page, not an exact line within the page across closing/reopening.

## Paper correction in 0.5.3

Clean pulp is the new default. It reduces the yellow colour cast, brightens the paper and increases ink contrast while retaining the original scanned texture. Two-finger tap for controls, then choose Paper: Clean pulp, Warm cream, Grayscale or Original scan. Contrast and Brightness sliders allow adjustment for each scan. Your choice is remembered per book in this browser.

Original scan bypasses every colour adjustment. These are reversible display filters; they never alter the Archive image or the selectable text geometry. Black borders remain black. This is a tunable colour treatment, not automatic white-balance analysis or reconstruction of faded detail. Use gentler contrast if fine print or paper highlights start disappearing. Filter strength does not change automatically from page to page.

## Fixes in 0.5.2

Text paragraphs now retain Archive’s native margin-based layout. The prior version incorrectly added absolute positioning, applying paragraph offsets twice. The selection layer now fits the displayed scan’s actual rectangle, including its black borders, and scales each axis against the scan rather than assuming identical OCR and image dimensions.

Opening a lookup latches a dismissal guard. Safari may clear its selection before delivering the next tap; that tap is still consumed as dismissal, without turning the page. The following ordinary tap resumes page navigation. Two-finger taps still control the reader menu.

## Word selection

The original scanned page remains visible. Quiet Leaf now copies the native reader’s already-rendered invisible text layer over it, preserving the native word geometry and scaling it with the scan. It makes no separate OCR requests and does not reformat the book. Text selection depends on Archive providing that layer for the page; it can arrive shortly after the scan. Pages without a native text layer do not gain selectable words from this update.

Long-press and the context menu are no longer intercepted. Long presses, pinches, and taps that dismiss an existing selection do not turn pages. Reader controls use a short two-finger tap; the keyboard Space shortcut still works. The script cannot choose or force the exact actions iPadOS offers in its native selection popup.

## Progress and native bookmarks

Read quietly resumes the farthest visited page automatically. A page counts only after its scan successfully appears. Turning backward does not reduce progress. Use Set progress here if an accidental jump has advanced it too far.

Progress is saved locally per book in this browser profile and synced to Archive’s native bookmark service using your existing signed-in session. The menu reports whether the server has confirmed the save or whether sync is pending. Local progress remains available after reopening Safari, provided site data has not been cleared. Other devices can resume from the server marker after a successful sync. Local backup is browser-specific, not account-specific; take care when switching Archive accounts in a shared browser.

The automatic marker is red; the bookmark button makes a blue bookmark. Archive stores one bookmark per scanned leaf. If a manual bookmark occupies the progress page, its colour and notes take priority. Its progress tag moves onward when you advance, leaving that bookmark intact. Existing bookmarks and notes are preserved; tapping Blue bookmark explicitly changes that page’s colour to blue.

Quiet Leaf adds `[Quiet Leaf progress v1]` to its automatic marker’s note. For an existing bookmark, it uses `[Quiet Leaf progress v1; preserve bookmark]`. These tags identify which progress marker may be moved without deleting your own bookmarks. Avoid editing these tags if you want automatic resume to work across devices. Each new marker is read back from Archive before the old marker is removed. Interrupted sync can temporarily leave multiple markers; a later sync reconciles them.

Bookmarks are real Archive bookmarks. Archive’s already-open sidebar may retain an old in-memory list; reload the Archive page to refresh that list if necessary. This version does not infer historical progress from ordinary untagged bookmarks: it starts tracking when you first read with 0.5.

## Loading, sleep and renewal

Navigation uses the native reader so it can load scans beyond those already downloaded. A failed load keeps your current scan visible and offers Retry, Keep current page, and Back to Archive. Returning after sleep or reconnecting checks the reader and retries pending sync. When access needs attention, return to Archive to complete its normal borrowing flow.

Page turns and neighbouring-leaf prefetch both move Archive’s reader. BookReader emits `BookReader:userAction` for every visible leaf change, and Quiet Leaf relies on that event. If native navigation already emits it, Quiet Leaf does not add a duplicate. Slider prefetch of a neighbouring leaf is accepted reading activity, not a separate idle ping. Archive’s own activity listener decides whether to renew the loan; its token-refresh logic stays in charge. Waking the tab does not synthesize an extra idle event. Quiet Leaf does not guarantee that a renewal will be granted.

## Privacy

Runs in Safari’s isolated extension context. No page-script injection, token extraction, nonce reuse, analytics, external script dependencies, bulk download or persistent scan storage. It draws only the image decoded by the official reader to an in-memory canvas, without pixel readback or export. Normal browser caching still applies. The native text layer is kept in memory for the displayed page. Progress and paper-display preferences are saved locally. Bookmark requests go to Archive’s own `/services/bookmarks.php` with your same-origin session.

## Verification and limits

Regression tests cover native navigation without preloaded future pages, activity events without duplicates, the 1:5 tap split, moving red markers, blue collisions, preservation of existing bookmarks and notes, local and remote resume, failed scan recovery, bookmark-service failures, backward progress reset, fullscreen exit during loading, delayed text-layer arrival, text-layer alignment on resize, long-press pass-through, two-finger controls, pinch rejection, and selection dismissal.

The startup and continuous-scroll fixtures use a real jQuery UI slider with the Bookmarks panel absent and the navigation hidden. Startup tests jump to scan 242 from both earlier and later scans, in both reading modes, including fullscreen loss during navigation. Interaction tests use a simulated DOM. A separate Chromium rendering test compares every test word’s position, size and hit target with its native counterpart in portrait and landscape layouts (1024×1366, 1366×1024 and 768×1366). The continuous-scroll browser fixture tests width fitting, native lazy loading, unchanged farthest progress during prefetch, a `BookReader:userAction` event on every leaf change including slider prefetch, forward/backward bookmarking, memory eviction and reload, rotation, retry, mode switches, saved mode and resume. These tests do not use a physical iPad or authenticated loan. The native iPad selection popup, Safari-specific behaviour, and actual loan renewal still require on-device verification. Archive DOM or API changes can require an adapter update. This reader supports the usual left-to-right navigation. Image quality depends on the native scan resolution. Concurrent edits from multiple devices cannot be made fully atomic through the native bookmark API.

For development tests, run `npm install`, then `npm test` inside this folder. For rendered layout and continuous-scroll tests, run `npx playwright install chromium --only-shell`, then `npm run test:layout`, `npm run test:scroll`, and `npm run test:startup`. The userscript requires no build or dependencies.

Sources: [Internet Archive BookReader](https://github.com/internetarchive/bookreader), [Userscripts](https://github.com/quoid/userscripts).

## Gulag regression coverage

Run `npm run test:gulag` after `npx playwright install chromium webkit` (Linux may also require `npx playwright install-deps`). It runs in Chromium and Playwright WebKit, using the three actual volume page ranges (671, 717 and 579 scans), `n` labels, path URLs, duplicate native sliders, missing initial ARIA values, forward/backward scrolling, progress-safe prefetch, a jump to scan n400, volume identity and the final scan boundary. The fixture models Archive’s custom Left/Right key handler and suppressed programmatic slider changes. `QL_JQUERY_UI=/path/to/jquery-ui.js` lets the same suite run against a downloaded legacy slider implementation; 1.11.1 and the pinned 1.13.3 are both checked for this release. `QL_ENGINE=chromium` runs Chromium alone. `QL_SOURCE=/path/to/old.user.js QL_PROBE=1` limits the run to the initial transition for before/after diagnosis.

These are controlled browser fixtures, not an authenticated live-Archive test or a physical iPad test. They do not validate iPadOS-specific touch gestures or loan renewal. Formal Firefox packaging and device verification remain in the backlog.
