# Azure Storage Static Website Deployment Script

# Configuration
$storageAccountName = "livestreamingui"
$resourceGroupName = "LiveStreamingRG"
$location = "centralindia"
$indexDocument = "index.html"
$errorDocument = "index.html"
$buildFolder = ".\dist"

# Ensure the build folder exists
if (-not (Test-Path $buildFolder)) {
    Write-Host "Build folder not found. Building the application..."
    npm run build
    if (-not (Test-Path $buildFolder)) {
        Write-Error "Build failed or build folder not found after build."
        exit 1
    }
}

# Check if storage account exists, create if not
$storageAccount = az storage account show --name $storageAccountName --resource-group $resourceGroupName | ConvertFrom-Json -ErrorAction SilentlyContinue
if (-not $storageAccount) {
    Write-Host "Creating storage account $storageAccountName in $resourceGroupName..."
    az storage account create --name $storageAccountName --resource-group $resourceGroupName --location $location --sku Standard_LRS --kind StorageV2 --https-only true
}

# Enable static website hosting
Write-Host "Enabling static website hosting..."
az storage blob service-properties update --account-name $storageAccountName --static-website --index-document $indexDocument --404-document $errorDocument

# Upload files to the $web container
Write-Host "Uploading files to the $web container..."
az storage blob upload-batch --account-name $storageAccountName --destination '$web' --source $buildFolder --overwrite

# Get the website URL
$websiteUrl = az storage account show --name $storageAccountName --resource-group $resourceGroupName --query "primaryEndpoints.web" --output tsv
Write-Host "Website deployed successfully to: $websiteUrl"

# Optional: Purge CDN endpoint if it exists
$cdnProfileName = "LiveStreamingCDN"
$cdnEndpointName = "livestreamingui"
$cdnEndpoint = az cdn endpoint show --name $cdnEndpointName --profile-name $cdnProfileName --resource-group $resourceGroupName | ConvertFrom-Json -ErrorAction SilentlyContinue
if ($cdnEndpoint) {
    Write-Host "Purging CDN endpoint..."
    az cdn endpoint purge --content-paths '/*' --profile-name $cdnProfileName --name $cdnEndpointName --resource-group $resourceGroupName
}

Write-Host "Deployment completed successfully!"
