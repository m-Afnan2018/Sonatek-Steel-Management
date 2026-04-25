# Social Media API Tokens — Setup Guide

How to get access tokens for each platform supported in the Social Media Scheduler.

---

## Table of Contents

- [Instagram](#instagram)
- [Facebook](#facebook)
- [Threads](#threads)
- [LinkedIn](#linkedin)
- [Google My Business (GMB)](#google-my-business-gmb)
- [YouTube](#youtube)
- [Pinterest](#pinterest)
- [Token Expiry Reference](#token-expiry-reference)

---

## Instagram

> Requires a **Facebook Developer Account** and an **Instagram Business or Creator account** connected to a Facebook Page.

### Step 1 — Create a Meta App

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click **My Apps → Create App**
3. Select **Business** as the app type
4. Enter an app name → Click **Create App**

### Step 2 — Add Products to the App

1. In the App Dashboard, click **Add Product**
2. Add **Facebook Login**
3. Add **Instagram Graph API**

### Step 3 — Generate a Long-Lived Access Token

1. Go to the [Graph API Explorer](https://developers.facebook.com/tools/explorer)
2. Select your app from the top-right dropdown
3. Click **Generate Access Token** and log in
4. In the **Permissions** panel, add:
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `instagram_basic`
   - `instagram_content_publish`
5. Click **Generate Access Token** → copy the token
6. Click the **ⓘ** icon next to the token → click **Open in Access Token Tool**
7. Click **Extend Access Token** → copy the new long-lived token

> Long-lived tokens are valid for **60 days**. You must manually extend them before expiry.

### Step 4 — Get Your Instagram User ID

1. In the Graph API Explorer, first run:
   ```
   GET /me/accounts
   ```
   Find your Facebook Page in the result → copy its `id` (this is your **Page ID**)

2. Then run:
   ```
   GET /{page-id}?fields=instagram_business_account
   ```
   Copy the `id` inside `instagram_business_account` — this is your **Instagram User ID**

### What to paste in the app

| Field | Value |
|---|---|
| Access Token | The long-lived token from Step 3 |
| Instagram User ID | The `id` from Step 4 |

---

## Facebook

> Requires a **Facebook Page** (not a personal profile) and a **Facebook Developer Account**.

### Step 1 — Create a Meta App

Same as Instagram Step 1 above. If you already created one for Instagram, use the same app.

### Step 2 — Generate a Long-Lived Page Access Token

1. Go to the [Graph API Explorer](https://developers.facebook.com/tools/explorer)
2. Select your app from the top-right dropdown
3. Click **Generate Access Token** and log in
4. In the **Permissions** panel, add:
   - `pages_manage_posts`
   - `pages_read_engagement`
5. Click **Generate Access Token** → copy the token
6. Click the **ⓘ** icon → **Open in Access Token Tool** → **Extend Access Token**
7. Copy the long-lived token

### Step 3 — Get Your Page ID

1. In the Graph API Explorer, run:
   ```
   GET /me/accounts
   ```
2. Find your page in the response → copy the `id` field — this is your **Page ID**

> Alternatively: go to your Facebook Page → **About** → scroll down to find **Page ID** at the bottom.

### What to paste in the app

| Field | Value |
|---|---|
| Access Token | The long-lived token from Step 2 |
| Page ID | The `id` from Step 3 |

---

## Threads

> Requires a **Threads account** connected to a Meta Developer app. Threads API is part of Meta's ecosystem.

### Step 1 — Create or Open a Meta App

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Open an existing app or create a new one (select **Business** type)

### Step 2 — Add the Threads API Product

1. In your app dashboard → click **Add Product**
2. Find **Threads API** → click **Set Up**

### Step 3 — Add Your Threads Account as a Tester

1. Go to **Threads API → Quickstart** in the left sidebar
2. Under **Add Threads Testers**, click **Add** → enter your Instagram/Threads username
3. Open your Threads app on mobile → go to **Settings → Account → Website permissions → Apps and websites** → Accept the invite

### Step 4 — Generate Access Token

1. Still in **Threads API → Quickstart**
2. Under **Generate Access Token**, select your Threads account
3. Grant permissions:
   - `threads_basic`
   - `threads_content_publish`
4. Click **Generate Token** → copy the short-lived token
5. Exchange for a long-lived token by calling:
   ```
   GET https://graph.threads.net/access_token
     ?grant_type=th_exchange_token
     &client_id={app-id}
     &client_secret={app-secret}
     &access_token={short-lived-token}
   ```
   Copy the `access_token` from the response

### Step 5 — Get Your Threads User ID

Your **User ID** is returned alongside the token in the Quickstart section, or run:
```
GET https://graph.threads.net/v1.0/me?access_token={your-token}
```
Copy the `id` field (a long number like `17841400...`)

### What to paste in the app

| Field | Value |
|---|---|
| Access Token | The long-lived token from Step 4 |
| Threads User ID | The `id` from Step 5 |

---

## LinkedIn

> Requires a **LinkedIn Developer App** and a LinkedIn account. For company page posting, your account must be an admin of the page.

### Step 1 — Create a LinkedIn App

1. Go to [linkedin.com/developers/apps](https://www.linkedin.com/developers/apps)
2. Click **Create App**
3. Fill in the app name, your LinkedIn Company Page, and logo
4. Click **Create App**

### Step 2 — Request Permissions

1. In your app → go to the **Products** tab
2. Request access to **Share on LinkedIn**
3. Request access to **Sign In with LinkedIn using OpenID Connect**
4. Approval is usually instant for basic sharing

### Step 3 — Get Your Client ID and Secret

1. Go to the **Auth** tab of your app
2. Copy your **Client ID** and **Client Secret**
3. Under **OAuth 2.0 Settings**, add `https://localhost` as an **Authorized Redirect URL** → Save

### Step 4 — Authorize and Get the Code

Open this URL in your browser (replace `YOUR_CLIENT_ID`):

```
https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=https://localhost&scope=openid%20profile%20w_member_social
```

1. Log in and click **Allow**
2. Your browser will redirect to `https://localhost/?code=XXXX`
3. Copy the `code` value from the URL

### Step 5 — Exchange the Code for an Access Token

Run this in your terminal:

```bash
curl -X POST https://www.linkedin.com/oauth/v2/accessToken \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=PASTE_CODE_HERE" \
  -d "redirect_uri=https://localhost" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"
```

Copy the `access_token` from the JSON response.

### Step 6 — Get Your Author URN

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://api.linkedin.com/v2/userinfo
```

Find `"sub": "abc123"` in the response → your URN is:
```
urn:li:person:abc123
```

**For a Company Page:** Go to your company page URL — the number at the end is the org ID:
```
urn:li:organization:12345678
```

### What to paste in the app

| Field | Value |
|---|---|
| Access Token | Token from Step 5 |
| Author URN | `urn:li:person:xxx` or `urn:li:organization:xxx` from Step 6 |

---

## Google My Business (GMB)

> Requires a **Google Cloud project** and a verified **Google Business Profile**.

### Step 1 — Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown → **New Project** → name it → **Create**

### Step 2 — Enable the Required APIs

1. Go to **APIs & Services → Enable APIs & Services**
2. Search and enable:
   - **My Business Business Information API**
   - **My Business Account Management API**
   - **My Business Notifications API**

### Step 3 — Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth Client ID**
2. If prompted, configure the **OAuth Consent Screen** first:
   - User Type: **External** → fill in app name and your email → Save
3. Application type: **Web Application**
4. Under **Authorized Redirect URIs**, add:
   ```
   https://developers.google.com/oauthplayground
   ```
5. Click **Create** → copy your **Client ID** and **Client Secret**

### Step 4 — Get Access Token via OAuth Playground

1. Go to [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground)
2. Click the **gear icon** (top right) → check **Use your own OAuth credentials**
3. Enter your **Client ID** and **Client Secret** → Close
4. In **Step 1**, scroll to find or type in the input box:
   ```
   https://www.googleapis.com/auth/business.manage
   ```
5. Click **Authorize APIs** → sign in with your Google account → Allow
6. In **Step 2**, click **Exchange authorization code for tokens**
7. Copy the **Access Token**
8. Also copy the **Refresh Token** and save it somewhere safe (used to get new tokens without re-authorizing)

### Step 5 — Get Your Account ID

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://mybusinessaccountmanagement.googleapis.com/v1/accounts
```

Copy the `name` field from the result, e.g. `accounts/123456789` — this is your **Account ID**

### Step 6 — Get Your Location ID

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  "https://mybusinessbusinessinformation.googleapis.com/v1/accounts/YOUR_ACCOUNT_ID/locations"
```

Copy the `name` field from the location, e.g. `locations/987654321` — this is your **Location ID**

### What to paste in the app

| Field | Value |
|---|---|
| Access Token | Token from Step 4 |
| GMB Account ID | e.g. `accounts/123456789` |
| Location ID | e.g. `locations/987654321` |

> ⚠️ GMB tokens expire in **1 hour**. Use the Refresh Token to generate new ones as needed.

---

## YouTube

> Requires a **Google Cloud project** (same one as GMB is fine) and a **YouTube channel**.
> Community Posts require a channel with **500+ subscribers**.

### Step 1 — Enable YouTube Data API

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → your project
2. Go to **APIs & Services → Enable APIs & Services**
3. Search for **YouTube Data API v3** → Enable it

### Step 2 — Create OAuth Credentials

Same as GMB Step 3 above. If you already created credentials for GMB, you can reuse them.

### Step 3 — Get Access Token via OAuth Playground

1. Go to [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground)
2. Click the **gear icon** → check **Use your own OAuth credentials** → enter your Client ID and Secret
3. In **Step 1**, find and select:
   ```
   https://www.googleapis.com/auth/youtube.force-ssl
   ```
4. Click **Authorize APIs** → sign in with the Google account that owns your YouTube channel → Allow
5. Click **Exchange authorization code for tokens**
6. Copy the **Access Token** and **Refresh Token**

### Step 4 — Get Your Channel ID

**Option A — From the YouTube website:**
1. Go to [youtube.com](https://youtube.com)
2. Click your profile picture → **Your Channel**
3. The URL will look like: `https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxx`
4. Copy everything after `/channel/` — that is your **Channel ID**

**Option B — Via API:**
```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true"
```

### What to paste in the app

| Field | Value |
|---|---|
| Access Token | Token from Step 3 |
| Channel ID | e.g. `UCxxxxxxxxxxxxxxxxx` |

> ⚠️ YouTube tokens expire in **1 hour**. Save the Refresh Token.

---

## Pinterest

> Requires a **Pinterest Business Account** and a **Pinterest Developer App**.

### Step 1 — Switch to a Business Account

1. Go to [pinterest.com](https://pinterest.com) → click your profile
2. **Settings → Account management → Convert to business account** (free)

### Step 2 — Create a Pinterest App

1. Go to [developers.pinterest.com](https://developers.pinterest.com)
2. Click **My Apps → Create App**
3. Fill in the app name and description
4. Accept the developer terms → **Create**

> Trial access is instant. Full production access may require review for some scopes.

### Step 3 — Get Your App ID and Secret

1. In your app dashboard → **Overview** tab
2. Copy your **App ID** and **App Secret Key**

### Step 4 — Add a Redirect URI

1. Go to your app → **Authentication** tab
2. Under **Redirect URIs**, add:
   ```
   https://localhost
   ```
3. Save

### Step 5 — Authorize and Get the Code

Open this URL in your browser (replace `YOUR_APP_ID`):

```
https://www.pinterest.com/oauth/?client_id=YOUR_APP_ID&redirect_uri=https://localhost&response_type=code&scope=boards:read,pins:read,pins:write
```

1. Log in and click **Give access**
2. Your browser redirects to `https://localhost/?code=XXXX`
3. Copy the `code` from the URL

### Step 6 — Exchange Code for Access Token

```bash
curl -X POST https://api.pinterest.com/v5/oauth/token \
  -u "YOUR_APP_ID:YOUR_APP_SECRET_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=PASTE_CODE_HERE" \
  -d "redirect_uri=https://localhost"
```

Copy the `access_token` from the response.

### Step 7 — Get Your Board ID

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://api.pinterest.com/v5/boards
```

Find the board you want to post to → copy its `id` field.

### What to paste in the app

| Field | Value |
|---|---|
| Access Token | Token from Step 6 |
| Board ID | The `id` from Step 7 |

---

## Token Expiry Reference

| Platform | Token Lifetime | Action When Expired |
|---|---|---|
| Instagram | 60 days | Re-extend via Access Token Tool |
| Facebook | 60 days | Re-extend via Access Token Tool |
| Threads | 60 days | Re-extend via Threads API |
| LinkedIn | 60 days | Repeat the OAuth flow (Steps 4–5) |
| GMB | 1 hour | Use Refresh Token to get a new one |
| YouTube | 1 hour | Use Refresh Token to get a new one |
| Pinterest | 30 days | Repeat the OAuth flow (Steps 5–6) |

### Refreshing a Google Token (GMB / YouTube)

When your GMB or YouTube access token expires, run:

```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "refresh_token=YOUR_REFRESH_TOKEN" \
  -d "grant_type=refresh_token"
```

Copy the new `access_token` and update it in the app via **Edit Token**.

---

*For any issues with API access, refer to the official documentation:*
- *Meta: [developers.facebook.com/docs](https://developers.facebook.com/docs)*
- *LinkedIn: [learn.microsoft.com/linkedin](https://learn.microsoft.com/en-us/linkedin/)*
- *Google: [developers.google.com](https://developers.google.com)*
- *Pinterest: [developers.pinterest.com/docs](https://developers.pinterest.com/docs/)*
