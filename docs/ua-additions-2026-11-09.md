# User-Agent catalog additions — 2026-11-09

This change **only appends** entries; no existing User-Agent is removed, replaced, or reordered. Both the legacy v2 Firefox catalog and v3 catalog are extended, and the build source list in `node/assets/list-34.json` receives the same input UAs. The browser/OS map files do not require edits because all target categories already exist.

## New stable User-Agent entries

| Category | UA-advertised version | Added variants |
| --- | --- | --- |
| Firefox on Android | Firefox/159.0 (stable release 159.0.1) | Android 16 phone and tablet |
| Safari on macOS | Version/27.2 | Mac desktop |
| Safari on iOS/iPadOS | Version/27.2 | iPhone and iPad in mobile-site mode |

```text
Mozilla/5.0 (Android 16; Mobile; rv:159.0) Gecko/159.0 Firefox/159.0
Mozilla/5.0 (Android 16; Tablet; rv:159.0) Gecko/159.0 Firefox/159.0
Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Safari/605.1.15
Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Mobile/15E148 Safari/604.1
Mozilla/5.0 (iPad; CPU OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Mobile/15E148 Safari/604.1
```

### Version compatibility notes

- Mozilla released Firefox for Android 159.0.1 on November 3, 2026. Firefox's commonly exposed UA token uses the major/minor `159.0` value rather than the patch-release suffix `159.0.1`.
- Apple released stable Safari 27.2 on October 26, 2026 (Safari 27.3 beta is not included).
- Safari's modern UA freezes the reported macOS version at `10_15_7`. Recent iPhone/iPad UA strings freeze the OS token at `18_7` even when Safari's real version is 27.2. Do not replace these with a literal macOS 27 or iOS 27 version in the UA comment.
- An iPad requesting desktop sites generally sends the same UA as the Mac; the extra iPad entry represents mobile-site mode only.
- `safari-android.json` is intentionally untouched: Apple does not ship a native Safari browser for Android. The historical Android/Safari-labeled records in the repository are preserved unchanged, but adding a new fabricated “Safari 27.2 Android” UA would misrepresent a nonexistent browser.
- UA spoofing alone does not change the underlying engine, TLS fingerprint, or all browser APIs; it is not a guarantee of full browser impersonation.

## Reference materials

- Firefox for Android 159.0.1 release notes: https://www.firefox.com/en-US/firefox/android/159.0.1/releasenotes/
- Firefox UA format: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/User-Agent/Firefox
- Apple Safari release notes: https://developer.apple.com/documentation/safari-release-notes/
- Apple WebKit OS-version freeze rationale: https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- Safari 27.2 UA examples (third-party reference): https://www.clearcotelabs.com/safari-user-agent

## Validation

- Each modified catalog parses as valid JSON.
- Each pre-existing entry is preserved exactly and in the same order; only the target array suffix grows.
- New UA strings are unique within each target catalog.
- All five UAs exist in both the v2 and v3 target catalogs and in the build input.
- No unrelated browser/OS categories and no Safari/Android catalog are modified.
