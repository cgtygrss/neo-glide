# Neo Glide - Google Play Publishing Steps

## ✅ Completed Steps

1. ✅ **Production Build Created** - Your app has been built and synced to Android
2. ✅ **App Icons Generated** - All Android icons and splash screens have been created

## 🔧 Next Steps (Manual)

### Step 1: Install Java (Required for signing)

You need Java Development Kit (JDK) to create the signing keystore:

**Option A - Install via Homebrew (Recommended):**
```bash
brew install openjdk@17
```

**Option B - Download from Oracle:**
Visit: https://www.oracle.com/java/technologies/downloads/

### Step 2: Create Signing Keystore

After installing Java, run this command to create your keystore:

```bash
cd /Users/cagataygurses/Documents/github/neon-glide
keytool -genkey -v -keystore neo-glide-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias neo-glide
```

You'll be prompted for:
- **Keystore password** - Choose a strong password and SAVE IT!
- **Key password** - Can be the same as keystore password
- Your name, organization, city, state, country

⚠️ **CRITICAL**: Save this keystore file and passwords securely! You'll need them for ALL future app updates.

### Step 3: Configure Build for Signing

Create a file `android/keystore.properties` with this content (replace with your actual passwords):

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=neo-glide
storeFile=../neo-glide-release-key.jks
```

⚠️ Add this file to `.gitignore` to keep credentials secure!

Then update `android/app/build.gradle` by adding this BEFORE the `android {` block:

```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

And update the `buildTypes` section inside `android {`:

```gradle
buildTypes {
    release {
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        
        if (keystorePropertiesFile.exists()) {
            signingConfig signingConfigs.release
        }
    }
}

signingConfigs {
    release {
        keyAlias keystoreProperties['keyAlias']
        keyPassword keystoreProperties['keyPassword']
        storeFile file(keystoreProperties['storeFile'])
        storePassword keystoreProperties['storePassword']
    }
}
```

### Step 4: Build Release AAB

Open the project in Android Studio:
```bash
npx cap open android
```

Then in Android Studio:
1. Go to **Build** → **Generate Signed Bundle / APK**
2. Select **Android App Bundle**
3. Click **Next**
4. Select your keystore file (`neo-glide-release-key.jks`)
5. Enter your passwords
6. Select **release** build variant
7. Click **Finish**

The AAB file will be created at:
`android/app/build/outputs/bundle/release/app-release.aab`

**Alternative (Command line):**
```bash
cd android
./gradlew bundleRelease
```

### Step 5: Prepare Store Listing Assets

Before uploading to Google Play, prepare these assets:

1. **App Icon** (512x512px) - Already in `resources/icon.png`
2. **Feature Graphic** (1024x500px) - Create a promotional banner
3. **Screenshots** (At least 2) - Take screenshots of your game
   - Phone: 320-3840px on longest side
   - Can be taken from Android emulator
4. **Privacy Policy** - You have `PRIVACY_POLICY.md`, host it online (GitHub Pages, or any web hosting)

### Step 6: Create Google Play Developer Account

1. Go to https://play.google.com/console
2. Sign in with your Google account
3. Pay the $25 one-time registration fee
4. Complete your account details

### Step 7: Upload to Google Play Console

1. In Play Console, click **Create app**
2. Fill in:
   - **App name**: Neo Glide
   - **Default language**: English (United States)
   - **App or game**: Game
   - **Free or paid**: Free

3. Complete the **Dashboard** requirements:
   - App access (declare if login required)
   - Ads (declare if app contains ads)
   - Content rating (complete questionnaire)
   - Target audience (age groups)
   - News app (No)
   - COVID-19 contact tracing/status apps (No)
   - Data safety (what data you collect)
   - Government app (No)

4. Go to **Production** → **Create new release**
5. Upload your AAB file (`app-release.aab`)
6. Add release notes
7. Click **Save** then **Review release**

8. Complete **Store listing**:
   - App name: Neo Glide
   - Short description: Fast-paced neon arcade shooter! Dodge, shoot, survive!
   - Full description: (See GOOGLE_PLAY_CHECKLIST.md for template)
   - App icon
   - Feature graphic
   - Screenshots
   - Category: Games > Arcade

9. Click **Submit for review**

### Step 8: Wait for Review

- Google typically reviews apps in 1-3 days
- You'll receive an email when approved or if changes are needed
- Once approved, your app will be live on Google Play!

## 📝 Important Notes

### Security Checklist
- [ ] Keystore file saved securely (backup in multiple locations)
- [ ] Passwords saved in password manager
- [ ] `keystore.properties` added to `.gitignore`
- [ ] Never commit keystore or passwords to Git

### App Information
- **Package ID**: com.cgtygrss.neoglide
- **Version Code**: 1
- **Version Name**: 1.0.0
- **Min SDK**: 22 (Android 5.1)
- **Target SDK**: 34 (Android 14)

### Future Updates
For future updates:
1. Update version in `android/app/build.gradle`:
   - Increment `versionCode` (2, 3, 4...)
   - Update `versionName` ("1.0.1", "1.1.0", etc.)
2. Build new AAB with same keystore
3. Upload to Google Play Console

## 🆘 Troubleshooting

**Issue**: Can't find keytool
- Install Java JDK 17 or higher

**Issue**: Build fails
- Run `cd android && ./gradlew clean`
- Try `npx cap sync android` again

**Issue**: Signing errors
- Check passwords in `keystore.properties`
- Verify keystore file path is correct

## 📞 Support Resources

- Google Play Console: https://play.google.com/console
- Capacitor Docs: https://capacitorjs.com/docs/android
- Android Signing Guide: https://developer.android.com/studio/publish/app-signing

---

**Current Status**: ✅ App built and ready for signing!
**Next Action**: Install Java and create signing keystore
