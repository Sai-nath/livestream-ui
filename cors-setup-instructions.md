# CORS Configuration for Backend

To fix the API communication issues between your frontend and backend, you need to configure CORS on your backend server to accept requests from your Static Web App domain.

## Backend CORS Configuration

Add the following CORS configuration to your backend server (in `server.js` or similar file):

```javascript
// CORS configuration for Azure Static Web App
app.use(cors({
  origin: ['https://thankful-dune-06ac8a600.6.azurestaticapps.net', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));
```

## Socket.IO CORS Configuration

If you're using Socket.IO, also update its CORS configuration:

```javascript
const io = new Server(server, {
  cors: {
    origin: ['https://thankful-dune-06ac8a600.6.azurestaticapps.net', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});
```

## Azure App Service Configuration

You may also need to configure CORS in the Azure portal for your App Service:

1. Go to your Azure App Service (LiveStreamingClaims)
2. Navigate to "API" → "CORS"
3. Add your Static Web App URL: `https://thankful-dune-06ac8a600.6.azurestaticapps.net`
4. Check "Enable Access-Control-Allow-Credentials"
5. Save the changes

This configuration will allow your frontend to communicate with your backend API without any routing issues.
