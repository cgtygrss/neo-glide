# Google Play Store Publishing Guide for Neo Glide

## Prerequisites

- **Google Play Developer Account** ($25 one-time fee): https://play.google.com/console
- **Android Studio** installed
- **Java Development Kit (JDK)** 17 or higher

## Step-by-Step Publishing Process

### 1. Build Your App for Production

```bash
npm run build
npx cap sync android
```

### 2. Prepare App Assets

Before submitting, ensure you have:
- [ ] App icon (512x512px) - placed in `resources/icon.png`
- [ ] Feature graphic (1024x500px) - for Play Store listing
- [ ] Screenshots (at least 2, max 8):
  - Phone: 320-3840px on longest side
  - 7-inch tablet: 320-3840px
  - 10-inch tablet: 320-3840px
- [ ] Privacy policy URL (required by Google)

### 3. Update App Information

#### Update package.json
```json
{
  "name": "neo-glide",
  "displayName": "Neo Glide",
  "version": "1.0.0"
}
```

#### Update capacitor.config.json
Your app ID is: `com.cgtygrss.neoglide`
- This must be unique in the Play Store
- Cannot be changed after publishing

### 4. Configure Android App

#### Update android/app/build.gradle
Key settings to verify:
```gradle
android {
    namespace "com.cgtygrss.neoglide"
    compileSdk 34
    
    defaultConfig {
        applicationId "com.cgtygrss.neoglide"
        minSdk 22
        targetSdk 34
        versionCode 1
        versionName "1.0.0"
    }
}
```

### 5. Generate App Icons

Run Capacitor assets generator:
```bash
npm install -D @capacitor/assets
npx capacitor-assets generate --android
```

This will generate all required icon sizes from your `resources/icon.png`.

### 6. Create a Signing Key

**IMPORTANT**: Keep this keystore file safe! You'll need it for all future updates.

```bash
keytool -genkey -v -keystore neo-glide-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias neo-glide
```

You'll be asked for:
- Keystore password (save this!)
- Your name
- Organization
- City/State/Country

**Save the keystore file in a secure location outside your project!**

### 7. Configure Signing in Android Studio

1. Open the project in Android Studio:
   ```bash
   npx cap open android
   ```

2. In Android Studio, go to **Build** → **Generate Signed Bundle / APK**

3. Select **Android App Bundle** (recommended) or **APK**

4. Choose your keystore file and enter credentials

5. Select **release** build variant

6. Click **Finish**

### 8. Alternative: Configure Signing via Gradle

Create `android/keystore.properties`:
```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=neo-glide
storeFile=../neo-glide-release-key.jks
```

**⚠️ Add to .gitignore:**
```
android/keystore.properties
*.jks
```

Update `android/app/build.gradle`:
```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    ...
    
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 9. Build Release Bundle

```bash
cd android
./gradlew bundleRelease
```

The AAB file will be at:
`android/app/build/outputs/bundle/release/app-release.aab`

### 10. Create Google Play Console Listing

1. Go to https://play.google.com/console
2. Click **"Create app"**
3. Fill in:
   - **App name**: Neo Glide
   - **Default language**: English (United States)
   - **App or game**: Game
   - **Free or paid**: Free

### 11. Fill Out Store Listing

#### App Details
- **App name**: Neo Glide
- **Short description** (80 chars max):
  ```
  Fast-paced neon arcade shooter! Dodge, shoot, survive in endless space action!
  ```

- **Full description** (4000 chars max):
  ```
  Blast through the neon cosmos in Neo Glide, an electrifying arcade space shooter!

  Experience intense, fast-paced gameplay as you pilot customizable ships through a stunning cyberpunk universe. Dodge deadly obstacles, battle fierce enemies, and compete for high scores in this addictive roguelike adventure.

  ⚡ KEY FEATURES ⚡

  🎮 INTENSE ARCADE ACTION
  • Fast-paced, adrenaline-pumping gameplay
  • Smooth 60fps performance
  • One-handed portrait controls
  • Perfect for quick gaming sessions

  🛸 CUSTOMIZABLE SHIPS
  • 5 unique ships with special abilities
  • Cruiser: Extra hull strength
  • Interceptor: Faster ammo regeneration
  • Stealth Ship: Reduced enemy spawns
  • Void Runner: Phase through obstacles

  ⚔️ POWERFUL WEAPONS
  • Plasma Cannon: High damage
  • Burst Laser: Triple shot spread
  • Missile Launcher: Explosive power
  • Railgun: Armor-piercing rounds

  👾 CHALLENGING ENEMIES
  • Speedster: Fast and agile purple fighters
  • Standard Fighter: Relentless red attackers
  • Juggernaut: Armored tanks with homing missiles

  💎 ROGUELIKE PROGRESSION
  • Collect currency during runs
  • Permanent upgrades between games
  • Hull Armor, Shield Generator, Thruster Boost
  • Battery Pack, Currency Multiplier

  🎨 STUNNING VISUALS
  • Vibrant neon cyberpunk aesthetic
  • Smooth particle effects
  • Dynamic parallax backgrounds
  • Immersive space environments

  🎵 DYNAMIC AUDIO
  • Retro-style soundtrack
  • Satisfying sound effects
  • Menu and gameplay music

  🏆 COMPETE & PROGRESS
  • Track your best scores
  • Improve with each run
  • Master enemy patterns
  • Unlock all ships and weapons

  Download Neo Glide now and prove your skills in the neon void!
  ```

#### Graphics
- **App icon**: 512x512px (will be generated from resources/icon.png)
- **Feature graphic**: 1024x500px (required)
- **Phone screenshots**: At least 2, max 8
- **7-inch tablet screenshots**: Optional but recommended
- **10-inch tablet screenshots**: Optional but recommended

#### Categorization
- **App category**: Games > Arcade
- **Tags**: arcade, shooter, space, action, roguelike

#### Contact Details
- **Email**: your.email@example.com
- **Website**: https://github.com/cgtygrss/neon-glide (or your website)
- **Privacy Policy URL**: Required - host your privacy policy online

### 12. Content Rating

Complete the questionnaire:
- **Select app category**: Games
- **Violence**: Unrealistic violence (shooting enemies)
- **Interactive elements**: None
- **Other**: Complete all questions honestly

### 13. Target Audience & Content

- **Target age**: Everyone (E for Everyone)
- **Store presence**: Available to all countries
- **Content**: Game content is appropriate for all ages

### 14. App Content

#### Privacy Policy
You must provide a privacy policy URL. Host your PRIVACY_POLICY.md at:
- GitHub Pages
- Your website
- A free service like https://www.privacypolicies.com

#### Data Safety
Declare what data your app collects:
- Neo Glide collects: **No user data** (game is offline, local storage only)
- Check "No, this app doesn't collect any of the required user data types"

### 15. Upload Your App Bundle

1. Go to **"Production"** → **"Create new release"**
2. Upload the AAB file: `android/app/build/outputs/bundle/release/app-release.aab`
3. Add release notes:
   ```
   Initial release of Neo Glide!
   
   Features:
   • Fast-paced arcade space shooter
   • 5 customizable ships
   • 4 powerful weapons
   • Roguelike progression system
   • Stunning neon visuals
   • Dynamic soundtrack
   ```

### 16. Review and Publish

1. Complete all required sections (marked with red exclamation marks)
2. Click **"Review release"**
3. Click **"Start rollout to Production"**
4. Wait for Google's review (typically 1-3 days)

## Build Commands Reference

```bash
# Development
npm run dev                      # Start dev server
npm run build                    # Build for production

# Android specific
npx cap sync android             # Sync web assets to Android
npx cap open android             # Open in Android Studio
cd android && ./gradlew bundleRelease  # Build release AAB

# Generate icons
npx capacitor-assets generate --android
```

## Testing Before Publishing

### Test on Android Device
1. Enable Developer Options on your Android device
2. Enable USB Debugging
3. Connect device via USB
4. In Android Studio, select your device
5. Click Run (▶️)

### Test Release Build
```bash
cd android
./gradlew installRelease
```

## App Updates

When you want to release an update:

1. **Update version in build.gradle**:
   ```gradle
   versionCode 2        // Increment by 1
   versionName "1.1.0"  // Update version string
   ```

2. **Build new bundle**:
   ```bash
   npm run build
   npx cap sync android
   cd android && ./gradlew bundleRelease
   ```

3. **Upload to Play Console**:
   - Create new release
   - Upload new AAB
   - Add release notes
   - Publish

## Important Notes

⚠️ **Keystore Security**
- NEVER commit your keystore or passwords to git
- Keep multiple backups of your keystore file
- If you lose it, you can never update your app!

⚠️ **App ID**
- Cannot be changed after first publish
- Current ID: `com.cgtygrss.neoglide`

⚠️ **Privacy Policy**
- Required by Google
- Must be publicly accessible URL
- Update if you add data collection features

## Troubleshooting

### Build Fails
```bash
cd android
./gradlew clean
./gradlew bundleRelease
```

### Signing Issues
- Verify keystore path in keystore.properties
- Check password is correct
- Ensure keystore.properties is not in .gitignore

### Version Conflicts
- Ensure versionCode is higher than previous release
- versionName should follow semantic versioning (1.0.0, 1.1.0, etc.)

## Resources

- [Google Play Console](https://play.google.com/console)
- [Android Developer Documentation](https://developer.android.com/)
- [Capacitor Android Documentation](https://capacitorjs.com/docs/android)
- [App Bundle Documentation](https://developer.android.com/guide/app-bundle)

## Support

For issues with Android build:
- Check Android Studio logs
- Run `./gradlew bundleRelease --stacktrace` for detailed errors
- Verify all dependencies are installed

---

**Good luck with your Google Play Store launch! 🚀**
