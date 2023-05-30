# set this to the path to the Sdk folder
ANDROID_HOME='/home/hilma/Android/Sdk/'

# run a local build
eas build --local --profile=preview --platform=android --output=output.apk

# list all connected devices
adb devices

# install to connected device
adb install output.apk

