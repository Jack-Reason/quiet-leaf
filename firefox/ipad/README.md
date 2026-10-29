# Firefox on iPad

Quiet Leaf **0.6.5** does not support Firefox on iPad. There is no install file, no userscript manager, and no compatibility claim for that app.

## Blocker

Firefox for iPad is Firefox for iOS. Checked **29 October 2026**:

1. Apple requires browsers on iOS and iPadOS to use WebKit, and its App Store rules restrict an app from downloading or executing code that adds or changes functionality. Mozilla’s 1 September 2026 policy note says Firefox therefore cannot offer the desktop and Android add-on ecosystem on iOS: [Browsers compete on privacy. When the operating system allows.](https://blog.mozilla.org/netpolicy/2026/09/01/browsers-compete-on-privacy-when-the-operating-system-allows/)

2. The same day Mozilla shipped Ad Blocker for Firefox on iOS as a built-in WebKit content blocker and wrote that extensions are not available on iOS the way they are on desktop and Android: [Ad Blocker for Firefox on iOS](https://blog.mozilla.org/en/firefox/ad-blocker-on-ios/). A content blocker hides matching requests. It cannot install or run Quiet Leaf.

3. Violentmonkey is a WebExtension. It has no Firefox for iOS or iPadOS build. A request for a Safari/iOS build is a separate App Store product, not something Firefox for iPad can load: [violentmonkey/violentmonkey#2324](https://github.com/violentmonkey/violentmonkey/issues/2324).

Desktop Firefox, Android Firefox, and iPad Safari do not carry over. iPad Safari continues to use `Quiet-Leaf.user.js` through the Userscripts app. That route is unchanged and is not Firefox.

## What can still be exercised

The shared reader runs in Playwright **WebKit 26.0**. `npm run test:layout` uses iPad-like viewports (1024×1366, 1366×1024, 768×1366) in Chromium, and `npm run test:origin` repeats a 1024×1366 viewport in WebKit. `npm run test:gulag` runs the three Gulag volumes in WebKit. Those runs execute the script in Playwright’s WebKit, not inside the Firefox for iPad application. They do not show that the iPad app can load a userscript.

No physical iPad was used. Touch gestures, the iPadOS selection menu, and authenticated loans remain outside this run, including for iPad Safari.
