---
title: "How to change the primary user of a device in Microsoft Endpoint from the last logged in user. Via Powershell. Via Graph API. In bulk."
date: "2024-02-18"
description: "A guide on updating the primary user of devices in Microsoft Endpoint using PowerShell and Graph API."
slug: "change-primary-user-microsoft-endpoint"
---

<p>Alright, I figured it would be good to start posting some tips and tricks to the world. I manage a Microsoft 365 E5 environment and utilize Autopilot for the quick deployment of computers. As you go through hundreds of deployments, day after day, you do get set on autopilot. It works well. A year goes by and look at that, your IT Deployment techs are the primary users on so many laptops in Endpoint. How do we fix this?</p>

<p>Well, I have the script for you. Run this in Powershell ISE with enough permissions to poll Graph API. Make sure you have the Graph API Powershell module imported.</p>

<p>Install with `Install-Module -Name Microsoft.Graph.Intune`</p>

<p>Now, the script:</p>

```powershell
# Connect-MgGraph -Scopes "DeviceManagementManagedDevices.ReadWrite.All", "User.Read.All"
# Function to get the last logged-on user for a device
function Get-LastLoggedOnUser {
    param (
        [string]$DeviceId
    )
    $device = Get-MgDeviceManagementManagedDevice -DeviceId $DeviceId
    if ($device.usersLoggedOn -and $device.usersLoggedOn.Count -gt 0) {
        # Assuming the last item in usersLoggedOn is the most recent
        $lastUser = $device.usersLoggedOn | Sort-Object -Property lastLogOnDateTime -Descending | Select-Object -First 1
        return $lastUser.userId
    }
    return $null
}

# Get all Windows 10 and 11 devices
$devices = Get-MgDeviceManagementManagedDevice -Filter "operatingSystem eq 'Windows' and (operatingSystemVersion startswith '10.' or operatingSystemVersion startswith '11.')"

foreach ($device in $devices) {
    try {
        $lastUserId = Get-LastLoggedOnUser -DeviceId $device.id
        if ($lastUserId) {
            $lastUser = Get-MgUser -UserId $lastUserId
            # Check if the current primary user is different from the last logged on user
            if ($device.userDisplayName -ne $lastUser.displayName) {
                $body = @{
                    "userId" = $lastUserId
                }
                # Update the primary user
                Update-MgDeviceManagementManagedDevice -ManagedDeviceId $device.id -BodyParameter $body
                Write-Host "Updated primary user to $($lastUser.displayName) for device: $($device.deviceName)"
            } else {
                Write-Host "Current primary user is already correct for device: $($device.deviceName)"
            }
        } else {
            Write-Host "No last logged on user found for device: $($device.deviceName)"
        }
    } catch {
        Write-Host "Failed to update primary user for device $($device.deviceName): $_"
    }
}
```

**Get-LastLoggedOnUser:** A helper function to find the last user who logged on to a device by checking the `usersLoggedOn` property. This assumes the last item in this list is the most recent, which might not always be true if the list is not sorted by login time.

**Get-MgDeviceManagementManagedDevice:** Used to fetch Windows 10 and 11 devices from Intune.

**Update-MgDeviceManagementManagedDevice:** Updates the device's primary user to the last logged-on user if they differ from the current primary user.

**Error Handling:** Basic error handling to catch and report issues with updating each device.

**Important Notes:**

- The script assumes you have already authenticated with Microsoft Graph. If not, add or ensure you have run the `Connect-MgGraph` command with the right scopes.
- This script uses the `usersLoggedOn` property to determine the last user, which might not always be up to date or accurate based on how Intune logs user activity.
- Test this script in a controlled environment before running it in production to ensure it behaves as expected.
