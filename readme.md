eas build -p android --profile preview
eas build -p ios --profile preview

eas build -p ios --profile production --auto-submit

eas submit --platform ios

sudo git add . && sudo git commit -m "working" && sudo git push origin new

eas update --channel preview --message "new update"

eas submit --platform ios --message "new update"

eas submit --platform android --message "new update"
