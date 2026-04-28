---
title: "How to remove empty groups in OKTA manually or via API?"
date: "2025-02-25"
description: "A guide on removing empty groups in OKTA using both manual and automated approaches."
slug: "remove-empty-okta-groups"
---

<h2>How do I remove empty groups in OKTA manually?</h2>

<p>Let's say we have a case of an app import for an org-to-org that imported groups accidentally. Now that those groups from the other tenant are in your tenant, it is extremely annoying when searching as these groups will show as zero users. Moreso, the only way to "remove" these groups is manually, one by one.</p>

<p>What if I told you there was a way to do this via python and the OKTA API?</p>

<h3>Manual Approach (Admin Console)</h3>
<ol>
  <li><strong>Navigate to Groups:</strong> Log in to your Okta Admin Console, go to Directory > Groups.</li>
  <li><strong>Filter for Empty Groups:</strong> Okta doesn't have a direct filter for groups with zero members, but you can sort or search manually. Look at the "Members" column - groups showing "0" are your targets.</li>
  <li><strong>Delete Empty Groups:</strong> Click on a group with zero members, then hit the More Actions dropdown (or similar option depending on your interface) and select Delete Group. Confirm the deletion. Repeat for each empty group.</li>
</ol>
<p>This works fine if you only have a handful of groups to check, but it's tedious for a large organization.</p>

<h3>Automated Approach (Okta API)</h3>
<p>For a faster, scalable solution - especially if you have many groups - use the Okta API:</p>
<ol>
  <li><strong>Get an API Token:</strong> In the Admin Console, go to Security > API > Tokens, and create a token with appropriate permissions.</li>
  <li><strong>List All Groups:</strong> Use the API endpoint GET /api/v1/groups to fetch all groups in your Okta org. This returns a JSON list with group details, including member counts.</li>
  <li><strong>Identify Empty Groups:</strong> Parse the response. Each group object includes a _embedded section with stats (if requested via expand=stats in the query). Check "membersCount": 0 to find empty ones.</li>
  <li><strong>Delete Empty Groups:</strong> For each group with zero members, grab its id and send a DELETE /api/v1/groups/{groupId} request. You'll need to authenticate with your API token.</li>
</ol>

<p>Here's a more robust Python script that handles pagination, error checking, and provides more detailed output:</p>

```python
import requests

# Replace these with your actual Okta details
API_TOKEN = "your-api-token-here"  # Your Okta API token
ORG_URL = "https://your-domain.okta.com"  # Your Okta domain

# Set up headers for API requests
HEADERS = {
    "Authorization": f"SSWS {API_TOKEN}",
    "Accept": "application/json"
}

def get_all_groups():
    """Fetch all groups with pagination."""
    groups = []
    url = f"{ORG_URL}/api/v1/groups?expand=stats"
    while url:
        try:
            response = requests.get(url, headers=HEADERS)
            response.raise_for_status()
            data = response.json()
            if isinstance(data, list):
                groups.extend(data)
            else:
                print(f"Unexpected response: {data}")
                break
            url = response.links.get("next", {}).get("url")
        except requests.exceptions.RequestException as error:
            print(f"Error fetching groups: {error}")
            break
    return groups

def get_member_count(group_id):
    """Fallback: Check member count by fetching users in the group."""
    try:
        response = requests.get(f"{ORG_URL}/api/v1/groups/{group_id}/users", headers=HEADERS)
        response.raise_for_status()
        return len(response.json())
    except requests.exceptions.RequestException as error:
        print(f"Error checking members for group {group_id}: {error}")
        return None

def delete_empty_groups():
    """Delete groups with zero members."""
    groups = get_all_groups()
    if not groups:
        print("No groups found or error occurred.")
        return

    for group in groups:
        if "id" not in group or "profile" not in group or "name" not in group["profile"]:
            print(f"Skipping malformed group: {group}")
            continue

        group_id = group["id"]
        group_name = group["profile"]["name"]

        if "_embedded" in group and "stats" in group["_embedded"]:
            member_count = group["_embedded"]["stats"].get("usersCount", -1)
        else:
            print(f"Stats unavailable for {group_name}, checking members directly...")
            member_count = get_member_count(group_id)

        if member_count is None:
            print(f"Skipping {group_name} due to error.")
            continue

        if member_count == 0:
            try:
                delete_response = requests.delete(f"{ORG_URL}/api/v1/groups/{group_id}", headers=HEADERS)
                if delete_response.status_code == 204:
                    print(f"Deleted empty group: {group_name} (ID: {group_id})")
                else:
                    print(f"Failed to delete {group_name}: {delete_response.status_code} - {delete_response.text}")
            except requests.exceptions.RequestException as error:
                print(f"Error deleting {group_name}: {error}")
        else:
            print(f"Skipping {group_name} - has {member_count} members")

if __name__ == "__main__":
    print("Starting Okta group cleanup...")
    delete_empty_groups()
    print("Cleanup complete.")
```

<h3>Things to Watch Out For</h3>
<ul>
  <li><strong>Permissions:</strong> Ensure your API token or admin account has rights to delete groups.</li>
  <li><strong>Linked Groups:</strong> If a group is tied to an app or rule, Okta might block deletion. Unassign it first under Applications or Group Rules.</li>
  <li><strong>Rate Limits:</strong> The API has limits - pace your requests if you're deleting in bulk.</li>
</ul>

<p>The API method is your best bet for efficiency. If scripting isn't your thing, you could also export the group list via a tool like Okta Workflows or a third-party integration, filter for zero-member groups in a spreadsheet, and delete them manually or via API calls. Either way, you'll have a cleaner Okta setup by the end of it.</p>
