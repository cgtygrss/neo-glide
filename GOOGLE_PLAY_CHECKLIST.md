# Google Play Store Publishing Checklist

## ✅ Pre-Publishing Checklist

### Required Assets
- [ ] App icon (512x512px) in `resources/icon.png`
- [ ] Feature graphic (1024x500px)
- [ ] At least 2 phone screenshots (320-3840px)
- [ ] Privacy policy hosted online

### Account Setup
- [ ] Google Play Developer account created ($25 one-time fee)
- [ ] Payment profile set up
- [ ] Tax information completed

### App Configuration
- [ ] App built for production (`npm run build`)
- [ ] Android synced (`npx cap sync android`)
- [ ] App tested on Android device or emulator
- [ ] Version numbers set correctly (versionCode: 1, versionName: "1.0.0")

### Security
- [ ] Keystore file created and backed up
- [ ] Keystore password saved securely
- [ ] keystore.properties added to .gitignore
- [ ] Release bundle signed with keystore

### Store Listing
- [ ] App name: Neo Glide
- [ ] Short description (80 chars)
- [ ] Full description (up to 4000 chars)
- [ ] Category: Games > Arcade
- [ ] Content rating completed
- [ ] Privacy policy URL added

### Build
- [ ] Release AAB generated (`./gradlew bundleRelease`)
- [ ] AAB file location noted: `android/app/build/outputs/bundle/release/app-release.aab`

## 📱 Quick Commands

```bash
# Build for production
npm run build
npx cap sync android

# Open in Android Studio
npx cap open android

# Generate release bundle
cd android
./gradlew bundleRelease

# Generate app icons
npx capacitor-assets generate --android
```

## 📋 Store Listing Information

**App Name:** Neo Glide

**Short Description (80 chars):**
Fast-paced neon arcade shooter! Dodge, shoot, survive in endless space action!

**Category:** Games > Arcade

**Tags:** arcade, shooter, space, action, roguelike

**Content Rating:** Everyone (E)

**Price:** Free

## 🔐 Security Reminder

⚠️ **NEVER commit these to Git:**
- `*.jks` (keystore files)
- `keystore.properties`
- Any file containing passwords

## 📞 Support Links

- Google Play Console: https://play.google.com/console
- Capacitor Docs: https://capacitorjs.com/docs/android
- Full Guide: See GOOGLE_PLAY_GUIDE.md

## 🚀 Next Steps

1. Create Google Play Developer account
2. Generate signing key
3. Build release bundle
4. Create app listing
5. Upload AAB
6. Submit for review
7. Wait 1-3 days for approval

---

**Current Status:** ✅ Android platform added and synced!
**Ready to:** Generate signing key and build release bundle
