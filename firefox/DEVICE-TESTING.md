# Verification record — issue #2

Candidate: **0.6.4a1**. Date prepared: **28 October 2026**. **Android-device verification: NOT RUN.** No supported Android/Firefox/Violentmonkey version combination is claimed yet. Issue #2 remains open, and merging requires the maintainer's testing and approval.

## Automated coverage

Run on macOS 27.0.1 with Node 24.22.1, Playwright 1.51.1 and the pinned dependencies. Package scripts were executed with the bundled pnpm runner or directly through their Node entrypoints; the equivalent npm commands are listed below. The fixture suites use simulated Archive controls, image responses, and bookmark data. They do not connect to a signed-in Archive account or validate a real loan.

| Check | What it can establish | Result |
| --- | --- | --- |
| `npm test` | Shared DOM navigation, activity, progress/bookmark safety, failures, selection gestures and paper preferences; Firefox adapter checks | Pass |
| `npm run test:layout`, `test:scroll`, `test:startup`, `test:gulag` | Existing Chromium rendering/startup/scroll and Chromium/WebKit three-volume Gulag regressions | Pass: Chromium 134.0.6998.35 and Playwright WebKit 18.4 |
| `npm run check:firefox`, `test:firefox` | Generated file freshness, separate object-realm payloads, index validation | Pass |
| `npm run test:firefox:browser` | Generated package in desktop Gecko fixtures, including all three volume bounds | Pass: Firefox 135.0 |
| `npm run test:firefox:manager` with the dependencies described in README | Genuine Violentmonkey execution in desktop Firefox, CSP, both event directions, session cookie, bookmarks/resume, slider/touch/scroll fixtures and final boundary | Pass: Firefox 135.0, Violentmonkey 2.50.0, geckodriver 0.37.1 |
| Same manager command with `QL_SOURCE=Quiet-Leaf.user.js` | Before/after reproduction against the unchanged 0.6.3 Safari install file | Expected failure reproduced: Firefox denies access to `bookmark` in the fallback event payload; scan-7 resume stays at 0 |

Violentmonkey XPI SHA256 for this run: `5e074465c7fdd31934e5b4664e3d2eac54269df575a0c0db52c843fe9afd81df`. All browser automation above ran on desktop macOS. Synthetic pointer events and copied text do not verify Android's touch recognizer or native selection menu. The original Safari install file is byte-for-byte identical to main 0.6.3.

## Physical Android run — maintainer to complete

Record these values for every tested combination:

| Field | Value |
| --- | --- |
| Test date and tester | Pending |
| Device model | Pending |
| Android version | Pending |
| Firefox version/channel | Pending |
| Violentmonkey version | Pending |
| Quiet Leaf version and commit | 0.6.4a1 / pending commit |
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

Maintainer test outcome: **Pending**. Approval to merge: **Not given**. No automatic merge is configured by this work. A real-device failure must be fixed and rechecked before Android support is declared complete.
