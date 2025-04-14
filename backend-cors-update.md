# Backend CORS Configuration Update

To fix the CORS policy issues, you need to add your Azure Static Web App URL to the allowed origins in your backend server.

## Update Express CORS Configuration

In your backend server (likely in `server.js` or `app.js`), update the CORS configuration as follows:

```javascript
const cors = require('cors');

// CORS configuration
app.use(cors({
  origin: [
    'https://thankful-dune-06ac8a600.6.azurestaticapps.net',  // Azure Static Web App URL
    'http://localhost:5173'  // Local development URL
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));
```

## Update Socket.IO CORS Configuration

If you're using Socket.IO, also update its CORS configuration:

```javascript
const io = new Server(server, {
  cors: {
    origin: [
      'https://thankful-dune-06ac8a600.6.azurestaticapps.net',  // Azure Static Web App URL
      'http://localhost:5173'  // Local development URL
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});
```

## Azure App Service CORS Configuration

You should also update the CORS settings in the Azure portal:

1. Go to your Azure App Service (LiveStreamingClaims)
2. Navigate to "API" → "CORS"
3. Add your Static Web App URL: `https://thankful-dune-06ac8a600.6.azurestaticapps.net`
4. Check "Enable Access-Control-Allow-Credentials"
5. Save the changes

## Deployment

After making these changes to your backend code, commit and push the changes to trigger a new deployment of your backend service.

```bash
git add .
git commit -m "Update CORS configuration to allow Azure Static Web App origin"
git push
```

This will ensure that your backend accepts requests from your frontend hosted on Azure Static Web Apps.
