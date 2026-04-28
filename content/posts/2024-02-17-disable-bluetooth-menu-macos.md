---
title: "Disable the bluetooth menu on macOS with a mobileconfig .plist file"
date: "2024-02-17"
description: "How to disable the Bluetooth menu on macOS using a mobileconfig .plist file."
slug: "disable-bluetooth-menu-macos"
---

I do not have a ton of time, but I do have a bluetooth problem.

What we have here is a plist for a MDM like JAMF Pro that will disable the bluetooth menu on macOS.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.example.disablebluetoothmenu</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/defaults</string>
        <string>write</string>
        <string>com.apple.controlcenter</string>
        <string>Bluetooth</string>
        <string>-bool</string>
        <string>false</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

This plist file, when deployed through a Mobile Device Management solution like JAMF Pro, will disable the Bluetooth menu in the macOS control center. It does this by setting the `Bluetooth` key in the `com.apple.controlcenter` domain to `false` using the `defaults` command.

Here is a breakdown of what the plist does:

- It sets a label for the task: `com.example.disablebluetoothmenu`
- It specifies the program to run: `/usr/bin/defaults`
- It provides arguments to the `defaults` command to write the Bluetooth setting
- It sets `RunAtLoad` to `true`, which means this will run when the configuration profile is loaded

This can be useful in environments where you want to restrict Bluetooth usage or simplify the user interface by removing unused options.
