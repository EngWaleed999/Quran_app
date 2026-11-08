# EAS Update workflow

The project is configured for EAS Update using the existing EAS project ID.

## One native build is required first

The APK currently installed on devices predates `expo-updates` and
`expo-navigation-bar`. It cannot receive OTA updates or use the new native
navigation-bar API. Build and install one new preview APK from this branch:

```bash
eas build --platform android --profile preview
```

After verifying it on the test devices, create the production APK from the
same native runtime:

```bash
eas build --platform android --profile production
```

## Publish code-only fixes

Preview:

```bash
eas update --channel preview --environment preview --message "Describe the fix"
```

Production, after preview validation:

```bash
eas update --channel production --environment production --message "Describe the release"
```

The app checks for updates on launch and uses the cached bundle immediately.
A downloaded update is applied on the next app launch.

## Compatibility boundary

EAS Update can deliver JavaScript/TypeScript fixes and compatible bundled
assets. It cannot add or change native modules, Android permissions, native
configuration, app icons, or native code. Those changes require another EAS
Build and a newly installed APK.

The canonical Quran SQLite database is intentionally unchanged. These updates
do not replace the installed `quran.db` or alter local notes/Khatmah data.
The native runtime uses the fingerprint policy so a future native change
produces a different runtime version and cannot receive an incompatible OTA
bundle.
