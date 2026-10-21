# Current Windows browser profiles

Verified on 2026-10-21. These profiles are appended to the existing Windows datasets; historical entries are retained.

## Windows 11 and version 26H2

Windows 11, including version 26H2, still uses the legacy `Windows NT 10.0` token in its browser User-Agent string. There is no standard `Windows NT 11.0` or `26H2` UA token.

Consequently, these strings are compatible with Windows 11 but cannot identify a particular Windows release. The bundled UA parser reports their OS as Windows 10; that is the interpretation of the legacy token, not evidence that the profiles are restricted to Windows 10. Their parsed OS metadata is deliberately left consistent with the UA string.

Distinguishing Windows 11 requires additional signals such as User-Agent Client Hints. This dataset update does not add Windows 11/26H2-specific Client Hints or guarantee Windows 11 detection on websites.

## Versions

| Browser | Verified stable release | Browser token in the profile | Chromium token |
| --- | --- | --- | --- |
| Chrome | 156.0.8078.47/.48 | Chrome/156.0.0.0 | 156.0.0.0 |
| Edge | 155.0.4283.62 | Edg/155.0.0.0 | 155.0.0.0 |
| Firefox | 158.0.1 | Firefox/158.0; rv:158.0 | Not applicable |
| Opera | 137.0.6036.63 | OPR/137.0.0.0 | 153.0.0.0 |
| Vivaldi | 8.2.4133.89 | Vivaldi/8.2.4133.89 | 152.0.0.0 |
| Brave | 1.97.59 | Brave/1.97.59 | 155.0.0.0 |
| Whale | 5.39.412.57 | Whale/5.39.412.57 | 150.0.0.0 |

Release versions and UA tokens are different: Chromium-based browsers reduce some version tokens, and Firefox exposes the major release as `158.0` even for a point release.

These are constructed desktop spoofing profiles based on the verified releases, not UA captures from installations of each browser on Windows 11 26H2. In particular, the Brave and Vivaldi tokens intentionally identify those browsers so the parser places the profiles in their respective lists. Brave's normal default UA identifies as Chrome; Vivaldi may also omit its own token for compatibility. The branded profiles should not be presented as universally exposed default UAs.

## Data maintenance

- `node/assets/list-34.json` supplies the seven strings to the existing v3 build.
- The corresponding v3 Windows browser JSON files each receive one parsed entry. Legacy v2/firefox files are unchanged.
- Entries are appended without replacing or relabeling existing profiles.
- The build script and its existing sampling limits are unchanged; a future full rebuild still applies those limits.
- Other browsers, including discontinued Windows browsers, are unchanged.

## Sources

- [Microsoft: Windows 11 version 26H2 availability](https://learn.microsoft.com/en-us/windows/release-health/status-windows-11-26h2)
- [Microsoft: User-Agent guidance and the Windows NT 10.0 token](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/user-agent-guidance)
- [Microsoft: Detect Windows 11 using Client Hints](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/how-to-detect-win11)
- [Chrome 156 stable desktop announcement](https://chromereleases.googleblog.com/2026/10/stable-channel-update-for-desktop_02018666648.html)
- [Edge stable release notes](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-relnote-stable-channel)
- [Firefox 158.0.1 release notes](https://www.firefox.com/en-US/firefox/158.0.1/releasenotes/)
- [Opera 137.0.6036.63 release](https://blogs.opera.com/desktop/2026/10/opera-137-0-6036-63-stable-update/)
- [Opera 137 changelog and Chromium version](https://blogs.opera.com/desktop/changelog-for-137/)
- [Vivaldi 8.2 update and Chromium version](https://vivaldi.com/blog/desktop/minor-update-eleven-8-2/)
- [Vivaldi Windows release archive](https://vivaldi.com/es/download/archive/?platform=win)
- [Brave 1.97.59 release and Chromium version](https://github.com/brave/brave-browser/releases/tag/v1.97.59)
- [Brave: default UA identifies as Chrome](https://brave.com/glossary/user-agent/)
- [Whale 5.39.412.57 release](https://forum.whale.naver.com/topic/62927/)
- [Whale 4.39 engine update to Chromium 150](https://forum.whale.naver.com/announcement/134-desktop-v4373783-%EC%97%85%EB%8D%B0%EC%9D%B4%ED%8A%B8/)
