#!/bin/bash
# Deploy Compliance Portal as Docker Container to Azure App Service

set -e

# Configuration
RESOURCE_GROUP="compliance-portal-rg"
LOCATION="centralus"
POSTGRES_ADMIN_USER="pgadmin"
POSTGRES_ADMIN_PASSWORD="P@ssw0rd123!"
IMAGE_TAG="latest"

echo "🚀 Starting containerized deployment to Azure..."
echo ""

# Step 1: Ensure resource group exists
echo "📁 Step 1: Creating resource group..."
az group create --name ${RESOURCE_GROUP} --location ${LOCATION} --output table
echo "✓ Resource group ready"
echo ""

# Step 2: Build the Docker image
echo "📦 Step 2: Building Docker image..."
cd /home/manojsingh/projects/compliance-skills/compliance-portal

docker build -t compliance-portal:${IMAGE_TAG} .
echo "✓ Docker image built successfully"
echo ""

# Step 3: Deploy infrastructure (creates ACR, App Service, PostgreSQL)
echo "🏗️  Step 3: Deploying Azure infrastructure..."
az deployment group create \
  --resource-group ${RESOURCE_GROUP} \
  --template-file infra/main-container.bicep \
  --parameters \
    postgresAdminUsername="${POSTGRES_ADMIN_USER}" \
    postgresAdminPassword="${POSTGRES_ADMIN_PASSWORD}" \
    dockerImageTag="${IMAGE_TAG}" \
  --query 'properties.outputs' \
  --output table

# Get ACR name and login server
ACR_NAME=$(az deployment group show \
  --resource-group ${RESOURCE_GROUP} \
  --name main-container \
  --query 'properties.outputs.containerRegistryName.value' \
  --output tsv)

ACR_LOGIN_SERVER=$(az deployment group show \
  --resource-group ${RESOURCE_GROUP} \
  --name main-container \
  --query 'properties.outputs.containerRegistryLoginServer.value' \
  --output tsv)

APP_SERVICE_NAME=$(az deployment group show \
  --resource-group ${RESOURCE_GROUP} \
  --name main-container \
  --query 'properties.outputs.appServiceName.value' \
  --output tsv)

echo "✓ Infrastructure deployed"
echo "  - Container Registry: ${ACR_NAME}"
echo "  - App Service: ${APP_SERVICE_NAME}"
echo ""

# Step 4: Login to Azure Container Registry
echo "🔐 Step 4: Logging into Azure Container Registry..."
az acr login --name ${ACR_NAME}
echo "✓ Logged into ACR"
echo ""

# Step 5: Tag and push image to ACR
echo "📤 Step 5: Pushing image to Azure Container Registry..."
docker tag compliance-portal:${IMAGE_TAG} ${ACR_LOGIN_SERVER}/compliance-portal:${IMAGE_TAG}
docker push ${ACR_LOGIN_SERVER}/compliance-portal:${IMAGE_TAG}
echo "✓ Image pushed to ACR"
echo ""

# Step 6: Restart App Service to pull new image
echo "🔄 Step 6: Restarting App Service..."
az webapp restart --resource-group ${RESOURCE_GROUP} --name ${APP_SERVICE_NAME}
echo "✓ App Service restarted"
echo ""

# Step 7: Wait for app to start and check health
echo "⏳ Step 7: Waiting for application to start (60 seconds)..."
sleep 60

APP_URL=$(az deployment group show \
  --resource-group ${RESOURCE_GROUP} \
  --name main-container \
  --query 'properties.outputs.appServiceUrl.value' \
  --output tsv)

echo "🧪 Testing application..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" ${APP_URL} || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Deployment successful!"
  echo ""
  echo "🌐 Application URL: ${APP_URL}"
  echo "📊 Container Registry: ${ACR_LOGIN_SERVER}"
  echo ""
  echo "To view logs: az webapp log tail --resource-group ${RESOURCE_GROUP} --name ${APP_SERVICE_NAME}"
else
  echo "⚠️  Application returned HTTP ${HTTP_CODE}"
  echo "Check logs: az webapp log tail --resource-group ${RESOURCE_GROUP} --name ${APP_SERVICE_NAME}"
  echo ""
  echo "Application URL: ${APP_URL}"
fi
