# Vercel Deployment Guide

## Setup

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```
   
   Follow the prompts:
   - Set up and deploy? **Y**
   - Which scope? Choose your account
   - Link to existing project? **N**
   - What's your project's name? **basement-murder-mystery**
   - In which directory is your code located? **.**
   - Want to override the settings? **N**

4. **For production deployment**:
   ```bash
   vercel --prod
   ```

## Environment Variables

After deployment, set these environment variables in Vercel dashboard:

### Optional - Twilio (for phone calls during meetings)
- `TWILIO_ACCOUNT_SID` - Your Twilio Account SID
- `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token
- `TWILIO_PHONE_NUMBER` - Your Twilio phone number (e.g., +15551234567)

### CORS (optional)
- `CORS_ORIGINS` - Comma-separated list of allowed origins (or leave blank for all)

To set environment variables:
1. Go to your project in Vercel dashboard
2. Click **Settings** → **Environment Variables**
3. Add each variable
4. Redeploy: `vercel --prod`

## Local Development

Frontend:
```bash
cd client
npm run dev
```

Backend:
```bash
cd server
npm start
```

## Architecture

- **Frontend**: React + Vite → Static files served from root
- **Backend**: Express API → Serverless function at `/api/*`
- **Data**: JSON files in `server/data/`

All API calls from the frontend go to `/api/*` on the same domain.
