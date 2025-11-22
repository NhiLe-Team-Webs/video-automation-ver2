# YouTube OAuth Setup Guide

This guide explains how to set up YouTube OAuth authentication for long-term automated video uploads.

## Overview

The system uses OAuth 2.0 with automatic token refresh to maintain long-term access to YouTube API without requiring manual re-authentication.

## Key Features

- ✅ **Automatic Token Refresh**: Access tokens are automatically refreshed before expiry
- ✅ **Persistent Authentication**: Refresh tokens allow indefinite access (until revoked)
- ✅ **Error Handling**: Graceful handling of expired or invalid tokens
- ✅ **Logging**: Detailed logs for token refresh events

## Initial Setup

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **YouTube Data API v3**
4. Create OAuth 2.0 credentials:
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3000/oauth/callback`
5. Copy **Client ID** and **Client Secret**

### 2. Configure Environment Variables

Add to your `.env` file:

```env
YOUTUBE_CLIENT_ID=your_client_id_here
YOUTUBE_CLIENT_SECRET=your_client_secret_here
YOUTUBE_REDIRECT_URI=http://localhost:3000/oauth/callback
```

### 3. Authenticate

1. Start the server:
   ```bash
   npm run dev
   ```

2. Open browser and navigate to:
   ```
   http://localhost:3000/oauth/start
   ```

3. Login with your Google account and authorize the application

4. Copy the tokens from the success page and add to `.env`:
   ```env
   YOUTUBE_ACCESS_TOKEN=ya29.a0...
   YOUTUBE_REFRESH_TOKEN=1//0e...
   ```

5. Restart the server to load new credentials

## How Token Refresh Works

### Automatic Refresh

The system automatically refreshes access tokens when:
- Token is expired
- Token will expire within 5 minutes
- Before each upload operation

```typescript
// Automatic refresh is triggered before upload
await youtubeService.upload(videoPath, metadata);
```

### Token Lifecycle

1. **Initial Authentication**: User authorizes app → Get access token + refresh token
2. **Access Token**: Valid for ~1 hour, used for API requests
3. **Refresh Token**: Valid indefinitely (until revoked), used to get new access tokens
4. **Auto Refresh**: System automatically refreshes access token before expiry
5. **Token Update Event**: New tokens are logged and stored in memory

### Event Listener

The OAuth client listens for token refresh events:

```typescript
this.oauth2Client.on('tokens', (tokens) => {
  logger.info('OAuth tokens refreshed automatically');
  // Tokens are automatically updated in the client
});
```

## Production Deployment

### Token Persistence

For production, you should persist tokens to survive server restarts:

**Option 1: Database Storage**
```typescript
this.oauth2Client.on('tokens', async (tokens) => {
  await database.saveTokens({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: tokens.expiry_date,
  });
});
```

**Option 2: Encrypted File Storage**
```typescript
this.oauth2Client.on('tokens', async (tokens) => {
  await fs.writeFile(
    'tokens.encrypted.json',
    encrypt(JSON.stringify(tokens))
  );
});
```

**Option 3: Environment Variables (Current)**
- Simple but requires manual update
- Suitable for development and small deployments
- Tokens in `.env` file

### Security Best Practices

1. **Never commit tokens to git**
   - Add `.env` to `.gitignore`
   - Use `.env.example` for template

2. **Encrypt tokens at rest**
   - Use encryption for stored tokens
   - Use secure key management (AWS KMS, Azure Key Vault, etc.)

3. **Rotate credentials regularly**
   - Revoke and regenerate OAuth credentials periodically
   - Monitor for unauthorized access

4. **Use service accounts for production**
   - Consider YouTube API service accounts for server-to-server
   - Avoid user OAuth for automated systems when possible

### Monitoring

Monitor token refresh events in logs:

```bash
# Check for token refresh
grep "OAuth tokens refreshed" logs/combined.log

# Check for token errors
grep "Failed to refresh access token" logs/error.log
```

## Troubleshooting

### Token Expired Error

**Error**: `Request had invalid authentication credentials`

**Solution**:
1. Check if refresh token exists in `.env`
2. Re-authenticate via `/oauth/start`
3. Verify tokens are loaded correctly in logs

### No Refresh Token

**Error**: `Access token expired and no refresh token available`

**Cause**: OAuth flow didn't return refresh token

**Solution**:
1. Revoke app access in [Google Account Settings](https://myaccount.google.com/permissions)
2. Re-authenticate with `prompt=consent` (automatic in `/oauth/start`)
3. Ensure `access_type: 'offline'` in OAuth config

### Token Refresh Failed

**Error**: `Failed to refresh access token`

**Possible Causes**:
- Refresh token revoked by user
- OAuth credentials changed in Google Console
- Network connectivity issues

**Solution**:
1. Check logs for detailed error message
2. Verify OAuth credentials in `.env`
3. Re-authenticate if refresh token is invalid

## Testing

Test the upload with valid credentials:

```bash
# Test full pipeline including upload
npx tsx test-rendering-and-upload.ts

# Check token status in logs
tail -f logs/combined.log | grep -i "token\|oauth"
```

## API Rate Limits

YouTube API has quota limits:
- **Default quota**: 10,000 units/day
- **Video upload**: 1,600 units per upload
- **Max uploads/day**: ~6 videos with default quota

Request quota increase in Google Cloud Console if needed.

## References

- [YouTube Data API](https://developers.google.com/youtube/v3)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google OAuth 2.0 Scopes](https://developers.google.com/identity/protocols/oauth2/scopes)
