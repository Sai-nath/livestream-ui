# Azure Storage Static Website Deployment Script

# Configuration
$storageAccountName = "livestreamingui"
$resourceGroupName = "LiveStreamingRG"
$location = "centralindia"
$indexDocument = "index.html"
$errorDocument = "index.html"
$buildFolder = ".\dist"

# Set environment variables for the build
Write-Host "Setting environment variables..." -ForegroundColor Cyan
$envFile = ".env"
if (Test-Path ".env.production") {
    Copy-Item ".env.production" $envFile -Force
}

@"
VITE_API_URL=https://livestreaming-fjghamgvdsdbd7ct.centralindia-01.azurewebsites.net
VITE_SOCKET_URL=wss://livestreaming-fjghamgvdsdbd7ct.centralindia-01.azurewebsites.net
VITE_APP_URL=https://livestreamingui.z13.web.core.windows.net
VITE_AWS_REGION=eu-north-1
VITE_AWS_S3_BUCKET=lvsbucket-5181
NODE_ENV=production
"@ | Out-File -FilePath $envFile -Encoding utf8 -Force

# Ensure the build folder exists
Write-Host "Building the application..." -ForegroundColor Cyan
npm ci
npm run build
if (-not (Test-Path $buildFolder)) {
    Write-Error "Build failed or build folder not found after build."
    exit 1
}

# Check if Azure CLI is installed
try {
    az --version | Out-Null
    Write-Host "Azure CLI is installed." -ForegroundColor Green
}
catch {
    Write-Error "Azure CLI is not installed. Please install it from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
}

# Check if logged in to Azure
try {
    $account = az account show | ConvertFrom-Json -ErrorAction Stop
    Write-Host "Logged in to Azure as $($account.user.name)" -ForegroundColor Green
}
catch {
    Write-Host "Not logged in to Azure. Please log in..." -ForegroundColor Yellow
    az login
}

# Check if resource group exists, create if not
try {
    $resourceGroup = az group show --name $resourceGroupName | ConvertFrom-Json -ErrorAction Stop
    Write-Host "Resource group $resourceGroupName exists." -ForegroundColor Green
}
catch {
    Write-Host "Creating resource group $resourceGroupName in $location..." -ForegroundColor Yellow
    az group create --name $resourceGroupName --location $location
}

# Check if storage account exists, create if not
try {
    $storageAccount = az storage account show --name $storageAccountName --resource-group $resourceGroupName | ConvertFrom-Json -ErrorAction Stop
    Write-Host "Storage account $storageAccountName exists." -ForegroundColor Green
}
catch {
    Write-Host "Creating storage account $storageAccountName in $resourceGroupName..." -ForegroundColor Yellow
    az storage account create --name $storageAccountName --resource-group $resourceGroupName --location $location --sku Standard_LRS --kind StorageV2 --https-only true
}

# Enable static website hosting
Write-Host "Enabling static website hosting..." -ForegroundColor Cyan
try {
    az storage blob service-properties update --account-name $storageAccountName --static-website --index-document $indexDocument --404-document $errorDocument
    Write-Host "Static website hosting enabled." -ForegroundColor Green
}
catch {
    Write-Error "Failed to enable static website hosting. Make sure you have the necessary permissions."
    exit 1
}

# Upload files to the $web container
Write-Host "Uploading files to the $web container..." -ForegroundColor Cyan
try {
    # Get storage account key for authentication
    $storageKey = (az storage account keys list --account-name $storageAccountName --resource-group $resourceGroupName | ConvertFrom-Json)[0].value
    
    # Upload files
    az storage blob upload-batch --account-name $storageAccountName --account-key $storageKey --destination '$web' --source $buildFolder --overwrite
    Write-Host "Files uploaded successfully." -ForegroundColor Green
}
catch {
    Write-Error "Failed to upload files: $_"
    exit 1
}

# Get the website URL
$websiteUrl = az storage account show --name $storageAccountName --resource-group $resourceGroupName --query "primaryEndpoints.web" --output tsv
$cleanUrl = $websiteUrl.TrimEnd('/')
Write-Host "Website deployed successfully to: $cleanUrl" -ForegroundColor Green

# Optional: Configure CORS for the storage account
Write-Host "Configuring CORS for the storage account..." -ForegroundColor Cyan
try {
    az storage cors add --account-name $storageAccountName --account-key $storageKey --services b --methods GET HEAD POST PUT DELETE OPTIONS --origins '*' --allowed-headers '*' --exposed-headers '*' --max-age 3600
    Write-Host "CORS configured successfully." -ForegroundColor Green
}
catch {
    Write-Warning "Failed to configure CORS: $_"
}

# Optional: Purge CDN endpoint if it exists
$cdnProfileName = "LiveStreamingCDN"
$cdnEndpointName = "livestreamingui"
try {
    $cdnEndpoint = az cdn endpoint show --name $cdnEndpointName --profile-name $cdnProfileName --resource-group $resourceGroupName | ConvertFrom-Json -ErrorAction Stop
    Write-Host "Purging CDN endpoint..." -ForegroundColor Cyan
    az cdn endpoint purge --content-paths '/*' --profile-name $cdnProfileName --name $cdnEndpointName --resource-group $resourceGroupName
    Write-Host "CDN endpoint purged successfully." -ForegroundColor Green
}
catch {
    Write-Host "No CDN endpoint found or unable to purge. Skipping CDN purge." -ForegroundColor Yellow
}

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Deployment completed successfully!" -ForegroundColor Green
Write-Host "Website URL: $cleanUrl" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Cyan
