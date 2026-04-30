#!/bin/bash
# Deploy Compliance Portal as Docker Container to Azure App Service

set -e

# Configuration
RESOURCE_GROUP="compliance-portal-rg"
LOCATION="centralus"
POSTGRES_ADMIN_USER="pgadmin"
POSTGRES_ADMIN_PASSWORD="P@ssw0rd123!"
IMAGE_TAG="latest"

# Service Principal Configuration (optional - fallback for token expiry)
# Set these as environment variables or pass as parameters:
# AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID
USE_SERVICE_PRINCIPAL="${USE_SERVICE_PRINCIPAL:-false}"

echo "🚀 Starting containerized deployment to Azure..."
echo ""

# Step 0: Authentication Check and Service Principal Setup
echo "🔐 Step 0: Verifying Azure authentication..."

# Check if service principal credentials are available
SP_AVAILABLE=false
if [[ -n "${AZURE_CLIENT_ID}" ]] && [[ -n "${AZURE_CLIENT_SECRET}" ]] && [[ -n "${AZURE_TENANT_ID}" ]]; then
  SP_AVAILABLE=true
  echo "🔑 Service Principal credentials detected"
  echo "   Will use for ACR authentication to prevent token expiry during push"
  
  # Try to login with service principal for general Azure operations
  # Note: May fail due to Conditional Access policies, but that's okay
  if [[ "${USE_SERVICE_PRINCIPAL}" == "true" ]]; then
    echo "   Attempting service principal login..."
    if az login --service-principal \
      --username "${AZURE_CLIENT_ID}" \
      --password "${AZURE_CLIENT_SECRET}" \
      --tenant "${AZURE_TENANT_ID}" \
      --output none 2>/dev/null; then
      echo "✓ Authenticated with Service Principal"
      echo "   (no token expiry issues for deployment)"
    else
      echo "⚠️  Service Principal login failed (likely Conditional Access policy)"
      echo "   Will use your user account for Azure operations"
      echo "   Service Principal will still be used for ACR authentication"
      SP_AVAILABLE=true  # Keep this true for ACR usage
    fi
  fi
fi

# Ensure user is logged in if service principal login didn't work
if ! az account show &>/dev/null; then
  echo "❌ Error: Not logged into Azure CLI."
  echo "   Please run 'az login' first"
  exit 1
fi

# Get current authentication info
AUTH_TYPE=$(az account show --query user.type -o tsv)
AUTH_USER=$(az account show --query user.name -o tsv)

if [[ "${AUTH_TYPE}" == "servicePrincipal" ]]; then
  echo "✓ Using Service Principal for all operations"
elif [[ "${SP_AVAILABLE}" == "true" ]]; then
  echo "✓ Using user account (${AUTH_USER}) for Azure operations"
  echo "✓ Will use Service Principal for ACR authentication only"
else
  echo "✓ Using user account (${AUTH_USER})"
  echo "⚠️  For long deployments, set service principal credentials to avoid token expiry:"
  echo "   source infra/.env.sp (if you have one)"
fi

# Display current subscription
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
echo "📋 Active subscription: ${SUBSCRIPTION_NAME}"
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

# Use service principal for ACR login if credentials are available
# This is critical to prevent token expiry during the long docker push operation
if [[ "${SP_AVAILABLE}" == "true" ]]; then
  echo "   Using service principal for ACR authentication (prevents token expiry)..."
  if az acr login --name ${ACR_NAME} --username "${AZURE_CLIENT_ID}" --password "${AZURE_CLIENT_SECRET}" 2>&1; then
    echo "✓ Logged into ACR with service principal"
  else
    echo "⚠️  Service principal ACR login failed, trying user authentication..."
    az acr login --name ${ACR_NAME}
  fi
else
  echo "   Using user authentication for ACR..."
  az acr login --name ${ACR_NAME}
  echo "   Note: Long docker push may fail if authentication token expires"
fi

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
