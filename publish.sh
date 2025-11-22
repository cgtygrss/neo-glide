#!/bin/bash

# Neo Glide - Quick Publishing Script
# This script helps you complete the publishing process

echo "🎮 Neo Glide - Google Play Publishing Helper"
echo "==========================================="
echo ""

# Check if Java is installed
if ! command -v keytool &> /dev/null; then
    echo "❌ Java is not installed!"
    echo ""
    echo "Please install Java first:"
    echo "  brew install openjdk@17"
    echo ""
    echo "Or download from: https://www.oracle.com/java/technologies/downloads/"
    exit 1
fi

echo "✅ Java is installed"
echo ""

# Check if keystore exists
if [ -f "neo-glide-release-key.jks" ]; then
    echo "✅ Keystore file already exists"
else
    echo "📝 Creating signing keystore..."
    echo ""
    echo "Please enter the following information:"
    echo "(You can press Enter to use defaults for most fields)"
    echo ""
    
    keytool -genkey -v -keystore neo-glide-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias neo-glide
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Keystore created successfully!"
        echo ""
        echo "⚠️  IMPORTANT: Save your keystore password securely!"
        echo "    You will need it for all future app updates."
        echo ""
    else
        echo "❌ Failed to create keystore"
        exit 1
    fi
fi

# Check if keystore.properties exists
if [ -f "android/keystore.properties" ]; then
    echo "✅ keystore.properties exists"
else
    echo ""
    echo "📝 Creating keystore.properties..."
    echo ""
    read -sp "Enter your keystore password: " STORE_PASS
    echo ""
    read -sp "Enter your key password (or press Enter to use same as keystore): " KEY_PASS
    echo ""
    
    if [ -z "$KEY_PASS" ]; then
        KEY_PASS=$STORE_PASS
    fi
    
    cat > android/keystore.properties << EOF
storePassword=$STORE_PASS
keyPassword=$KEY_PASS
keyAlias=neo-glide
storeFile=../neo-glide-release-key.jks
EOF
    
    echo "✅ keystore.properties created"
fi

echo ""
echo "🔨 Building release AAB..."
echo ""

cd android
./gradlew bundleRelease

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Release AAB built successfully!"
    echo ""
    echo "📦 Your app bundle is located at:"
    echo "   android/app/build/outputs/bundle/release/app-release.aab"
    echo ""
    echo "📋 Next steps:"
    echo "1. Create a Google Play Developer account (if you haven't)"
    echo "2. Go to https://play.google.com/console"
    echo "3. Create a new app"
    echo "4. Upload the AAB file"
    echo "5. Complete the store listing"
    echo "6. Submit for review"
    echo ""
    echo "📄 See PUBLISHING_STEPS.md for detailed instructions"
else
    echo ""
    echo "❌ Build failed!"
    echo "Check the error messages above"
    exit 1
fi
