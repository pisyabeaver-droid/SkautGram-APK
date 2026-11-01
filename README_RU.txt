SkautGram Full UI Upgrade
========================

Android APK project based on the existing SkautGram WebView shell.

Included:
- Telegram-inspired mobile chat layout (not copied Telegram source or branding)
- Chat list, search, tabs, message bubbles, local chat creation
- Local profile creation and persistence using browser localStorage
- Locally checked @username uniqueness on this device/browser
- Gift catalogue and local gift collection
- Profile editing

IMPORTANT LIMITATIONS
This build is a local prototype. Accounts, username checks, chats and gifts are stored only on this device in WebView localStorage. There is NO backend, no global username registry, no real multi-device messaging, no delivery to other users, no push notifications, and no end-to-end encryption. Clearing app data can erase local data. Do not use real passwords or sensitive information.

Build:
Push this project to GitHub and run the existing Actions workflow, then download the APK artifact.
