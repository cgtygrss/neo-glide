# App Store Assets

## App Icons
- Create an app icon with dimensions **1024x1024px**
- Save it as `icon.png` in this directory
- The icon should have no transparency and no rounded corners (iOS adds these automatically)
- Use simple, recognizable graphics that work at small sizes

## Splash Screen
- Create a splash screen with dimensions **2732x2732px**
- Save it as `splash.png` in this directory
- Keep important content in the center as it will be cropped for different screen sizes
- Use your brand colors and logo

## Generating Assets
After creating your icon.png and splash.png, run:
```bash
npm install -g @capacitor/assets
npx capacitor-assets generate
```

This will automatically generate all required icon and splash screen sizes for iOS.

## Screenshots Required for App Store
You'll need screenshots for the following device sizes:
- **6.7" Display (iPhone 15 Pro Max)**: 1290 x 2796 pixels
- **6.5" Display (iPhone 11 Pro Max)**: 1242 x 2688 pixels
- **5.5" Display (iPhone 8 Plus)**: 1242 x 2208 pixels

Take at least 3-5 screenshots showing key features of your game.

## Additional Requirements
- **Privacy Policy URL**: Required for App Store submission
- **App Description**: Prepare a compelling description (max 4000 characters)
- **Keywords**: Up to 100 characters for search optimization
- **App Preview Video** (optional): 15-30 seconds showcasing gameplay
