# Verification record — issue #2

0.6.5 regenerates the Firefox package from the Safari 0.6.5 reader. Issue #2 is closed: the remaining item was physical-device testing, and that requirement was dropped. This file is the 28 October 2026 automated record for the 0.6.4 package. It is not a new Android device run, and it does not claim a supported Android/Firefox/Violentmonkey combination on hardware.

Candidate at the time of that record: **0.6.4**, generated from the Safari 0.6.4 reader. **Android-device verification: NOT RUN.**

## Automated coverage

Run on Ubuntu 24.04.5 with Node 22.23.4, npm 10.9.9, Playwright 1.55.1 and the pinned dependencies, using the package scripts. The fixture suites use simulated Archive controls, image responses, and bookmark data. They do not connect to a signed-in Archive account or validate a real loan. The Android device rows were not run.

| Check | What it can establish | Result |
| --- | --- | --- |
| `npm test` | Shared DOM navigation, activity, progress/bookmark safety, failures, selection gestures, paper preferences, outside-stage touch release, and Firefox adapter checks | Pass |
| `npm run test:layout`, `test:scroll`, `test:startup`, `test:gulag` | Existing Chromium rendering/startup/scroll and Chromium/WebKit three-volume Gulag regressions | Pass: Chromium 140.0.7339.186 and Playwright WebKit 26.0 |
| `npm run check:firefox`, `test:firefox` | Generated file freshness, separate object-realm payloads, index validation | Pass |
| `npm run test:firefox:browser` | Generated package in desktop Gecko fixtures, including all three volume bounds and the outside-stage touch release | Pass: Firefox 141.0 |
| `npm run test:firefox:manager` with the dependencies described in README | Genuine Violentmonkey execution in desktop Firefox, CSP, both event directions, session cookie, bookmarks/resume, slider/touch/scroll fixtures and final boundary | Pass: Firefox 141.0, Violentmonkey 2.50.0, geckodriver 0.37.1 |
| Same manager command with `QL_SOURCE=Quiet-Leaf.user.js` | Before/after reproduction against the Safari 0.6.4 install file | Expected failure reproduced: Firefox denies access to `bookmark` in the fallback event payload; scan-7 resume stays at 0 |

Violentmonkey XPI SHA256 for this run: `5e074465c7fdd31934e5b4664e3d2eac54269df575a0c0db52c843fe9afd81df`. The Safari install file in that package was the 0.6.4 reader. Synthetic pointer events and copied text do not verify Android's touch recognizer or native selection menu. The Android device rows were not run.

## Physical Android run — maintainer to complete

Record these values for every tested combination:

| Field | Value |
| --- | --- |
| Test date and tester | Pending |
| Device model | Pending |
| Android version | Pending |
| Firefox version/channel | Pending |
| Violentmonkey version | Pending |
| Quiet Leaf version and commit | 0.6.4 / pending commit |
| Open-access book URLs and volumes | Pending |
| Borrowed-book URL and normal loan state | Pending |

Mark each row **Pass**, **Fail**, or **Not run**, with the book URL, scan number and observations. A desktop Firefox run belongs in a separate record, not this table.

| Scenario | Expected result | Device result |
| --- | --- | --- |
| Install via Violentmonkey, reload details and stream URLs | Exactly one versioned launcher; no page-injection/CSP workaround | Not run |
| Native Archive navigation and activation | Native scan loads before activation; Quiet Leaf opens the same scan or saved farthest scan | Not run |
| Single-page touch zones and controls | Left sixth goes back, remainder advances; ⋯ and short two-finger tap open/hide controls without turning a page | Not run |
| Native word selection | Long press, drag selection handles, use Android's offered actions; dismissal consumes one tap; next ordinary tap turns | Not run |
| Pinch, vertical swipes and rotation | No accidental page turn; scan/text stay aligned; controls remain reachable on a phone in either orientation | Not run |
| Continuous scroll | Forward and backward reading work; taps do not turn pages; nearby prefetch does not move farthest or send idle activity | Not run |
| Scrolling memory and retry | Distant scans reload into stable placeholders; a failed page does not advance progress; Retry recovers in place | Not run |
| Blue/manual bookmarks and sync | Archive confirms the blue bookmark; existing notes/colors survive advancing the red marker; verify Archive after reload | Not run |
| Progress and mode persistence | Close/reopen tab and restart Firefox: resume farthest in saved mode; backward reading never lowers farthest; confirmed reset does | Not run |
| Gulag volumes I, II and III | Test n9 → n10, backward reading, resume far ahead, each final scan; no phantom next page; volume identities/progress stay separate | Not run |
| Choose another volume through Archive | Back to Archive → Viewable files; select volume; reopen Quiet Leaf and verify correct per-volume marker | Not run |
| Actual authenticated borrowed book | Normal sign-in/borrow required; both modes, page turns, bookmarks and resume work while access is valid | Not run |
| Loan expiry/reborrow | Access failure is recoverable through Back to Archive and normal reborrow; no bypass and no progress counted for a missing scan | Not run |
| Sleep/reconnect and loan renewal | Wake/offline/online preserve progress; native Archive handles renewal when granted; no manufactured idle activity | Not run |
| Fullscreen and Android Back | Full screen or viewport fallback remains usable; fullscreen exit preserves reader; Back to Archive closes it cleanly | Not run |
| Cross-device bookmark resume | After confirmed sync, another signed-in device resumes the farthest marker; manual bookmarks/notes remain intact | Not run |

If a row fails, stop that scenario, note exact reproduction steps and capture the visible error. A screen recording is useful for touch/selection failures. Do not include cookies, signed image URLs, tokens, or private account details.

## Approval

Maintainer outcome for the Android device checklist: **Dropped**. Issue #2 is closed on that basis. A later hardware failure should come back as a new issue. The 0.6.5 package does not add a device run.
