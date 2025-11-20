# App Store Publishing Guide for Neon Glide

## Prerequisites
- **Apple Developer Account** ($99/year): https://developer.apple.com
- **macOS** with Xcode installed
- **App Store Connect** access

## Step-by-Step Publishing Process

### 1. Build Your App for Production
```bash
npm run build
npx cap sync ios
```

### 2. Prepare App Assets
Before submitting, ensure you have:
- [ ] App icon (1024x1024px) - placed in `resources/icon.png`
- [ ] Splash screen (2732x2732px) - placed in `resources/splash.png`
- [ ] Screenshots for required device sizes
- [ ] Privacy policy URL (required by Apple)
- [ ] App description and metadata

### 3. Configure App Information

#### Update Author Information
Edit `package.json` and replace:
```json
"author": "Your Name <your.email@example.com>"
```
with your actual name and email.

#### App Bundle Identifier
Your app ID is: `com.neonglide.game`
- This must be unique in the App Store
- If needed, change it in `capacitor.config.json`

### 4. Open in Xcode
```bash
npm run cap:open
```
or
```bash
npx cap open ios
```

### 5. Configure Signing & Capabilities in Xcode
1. Select your project in the navigator
2. Select the "Neon Glide" target
3. Go to "Signing & Capabilities"
4. Select your Team (requires Apple Developer account)
5. Ensure "Automatically manage signing" is checked

### 6. Set Version and Build Number
In Xcode:
- **General** tab → **Identity** section
- **Version**: 1.0.0 (matches package.json)
- **Build**: 1 (increment for each submission)

### 7. Configure Privacy Settings
Add privacy descriptions in `Info.plist` if your app uses:
- Camera: `NSCameraUsageDescription`
- Microphone: `NSMicrophoneUsageDescription`
- Location: `NSLocationWhenInUseUsageDescription`
- Photo Library: `NSPhotoLibraryUsageDescription`

### 8. Create App Store Connect Record
1. Go to https://appstoreconnect.apple.com
2. Click "My Apps" → "+" → "New App"
3. Fill in:
   - **Platform**: iOS
   - **Name**: Neon Glide
   - **Primary Language**: English
   - **Bundle ID**: com.neonglide.game
   - **SKU**: NEONGLIDE001 (or your choice)

### 9. Prepare App Store Information

#### Required Information:
- **App Name**: Neon Glide
- **Subtitle**: (max 30 characters) Brief tagline
- **Description**: Detailed description of your game (max 4000 chars)
- **Keywords**: Comma-separated keywords (max 100 chars)
- **Support URL**: Your website or support page
- **Marketing URL**: (optional)
- **Privacy Policy URL**: Required - must be publicly accessible

#### Screenshots Required:
Upload screenshots for:
- 6.7" Display (iPhone 15 Pro Max): 1290 x 2796 pixels
- 6.5" Display: 1242 x 2688 pixels (optional but recommended)
- 5.5" Display: 1242 x 2208 pixels (optional)

### 10. Archive and Upload
In Xcode:
1. Select "Any iOS Device" as the build target
2. Menu: **Product** → **Archive**
3. Wait for archive to complete
4. In Organizer window, click **Distribute App**
5. Select **App Store Connect**
6. Click **Upload**
7. Follow the prompts to upload

### 11. Submit for Review
1. Return to App Store Connect
2. Select your app
3. Go to the version you want to submit
4. Fill in all required information
5. Answer the Export Compliance questions
6. Click **Submit for Review**

### 12. App Review Process
- Apple typically reviews apps within 24-48 hours
- You'll receive email updates on the status
- Be ready to respond to any questions or issues

## Build Commands Reference

```bash
# Development
npm run dev                 # Start dev server
npm run host               # Start dev server with network access

# Production
npm run build              # Build for production
npm run ios:build          # Build and open in Xcode

# Capacitor
npm run cap:sync           # Sync web assets to native platforms
npm run cap:open           # Open iOS project in Xcode
```

## Testing Before Submission

### Test on Real Device
1. Connect your iPhone via USB
2. In Xcode, select your device as the build target
3. Click Run (▶️)
4. App will install and run on your device

### TestFlight (Beta Testing)
1. After uploading to App Store Connect
2. Go to TestFlight tab
3. Add internal/external testers
4. They'll receive an invite to test your app

## Common Issues

### Code Signing Errors
- Ensure you're logged into Xcode with your Apple ID
- Check that your Apple Developer account is active
- Try toggling "Automatically manage signing"

### Build Failures
- Clean build folder: **Product** → **Clean Build Folder**
- Delete derived data
- Restart Xcode

### App Rejection
- Common reasons: Privacy policy missing, crashes, broken features
- Review Apple's App Store Review Guidelines
- Fix issues and resubmit

## Resources
- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
- [App Store Connect Help](https://developer.apple.com/help/app-store-connect/)

## Privacy Policy Template
Your app needs a privacy policy. Here's what to include:
1. What data you collect (if any)
2. How you use the data
3. Whether you share data with third parties
4. How users can request data deletion
5. Contact information

You can use free tools like:
- https://www.privacypolicies.com
- https://app-privacy-policy-generator.nisrulz.com

## Next Steps After Approval
1. Monitor reviews and respond to user feedback
2. Track analytics in App Store Connect
3. Plan updates and new features
4. Increment version numbers for updates
