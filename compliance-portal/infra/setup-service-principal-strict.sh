#!/bin/bash
# Alternative Service Principal Setup for Strict Credential Policies
# Use this if your organization has strict credential lifetime policies (e.g., 90 days max)
# This uses a two-step approach: create SP with 1 year, then reset credentials with custom end date

set -e

echo "🔧 Azure Service Principal Setup (Strict Policy Mode)"
echo "========================================================="
echo ""
echo "This script creates service principals with custom credential"
echo "lifetimes for organizations with strict policies (7-365 days)."
echo ""

# Check if jq is installed
if ! command -v jq &>/dev/null; then
  echo "❌ Error: 'jq' is not installed."
  echo ""
  echo "Install it with:"
  echo "  Ubuntu/Debian: sudo apt-get install jq"
  echo "  macOS: brew install jq"
  echo ""
  exit 1
fi

# Check if logged in
if ! az account show &>/dev/null; then
  echo "❌ Not logged into Azure. Please run 'az login' first."
  exit 1
fi

# Get subscription info
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)

echo "📋 Current Subscription:"
echo "   Name: ${SUBSCRIPTION_NAME}"
echo "   ID: ${SUBSCRIPTION_ID}"
echo ""

# Ask for service principal name
read -p "Enter a name for the service principal (e.g., compliance-portal-sp): " SP_NAME

if [[ -z "${SP_NAME}" ]]; then
  echo "❌ Service principal name is required."
  exit 1
fi

# Ask for credential lifetime in days
echo ""
echo "⏱️  Credential Lifetime:"
echo "   Common policy limits: 7, 14, 30, 60, 90, 180 days"
read -p "Enter credential lifetime in DAYS (e.g., 90): " DAYS
DAYS=${DAYS:-90}

# Calculate end date in ISO 8601 format (required by Azure)
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  END_DATE=$(date -v+${DAYS}d -u +"%Y-%m-%dT%H:%M:%SZ")
  DISPLAY_DATE=$(date -v+${DAYS}d +"%Y-%m-%d")
else
  # Linux
  END_DATE=$(date -u -d "+${DAYS} days" +"%Y-%m-%dT%H:%M:%SZ")
  DISPLAY_DATE=$(date -d "+${DAYS} days" +"%Y-%m-%d")
fi

echo ""
echo "🔑 Step 1/4: Creating app registration..."
echo "   Name: ${SP_NAME}"
echo ""

# Step 1: Create app registration (no credentials yet, avoids policy)
APP_ID=$(az ad app create --display-name "${SP_NAME}" --query appId -o tsv 2>&1)

if [[ $? -ne 0 ]]; then
  echo ""
  echo "❌ Error creating app registration:"
  echo ""
  echo "$APP_ID"
  echo ""
  exit 1
fi

TENANT_ID=$(az account show --query tenantId -o tsv)

echo "✓ App registration created (App ID: ${APP_ID})"
echo ""

# Step 2: Create service principal
echo "🔑 Step 2/4: Creating service principal..."
echo ""

SP_CREATE=$(az ad sp create --id ${APP_ID} 2>&1)

if [[ $? -ne 0 ]]; then
  echo ""
  echo "❌ Error creating service principal:"
  echo ""
  echo "$SP_CREATE"
  echo ""
  echo "Cleaning up app registration..."
  az ad app delete --id ${APP_ID} 2>/dev/null
  exit 1
fi

echo "✓ Service principal created"
echo ""

# Step 3: Add credentials with custom end date
echo "🔑 Step 3/4: Adding ${DAYS}-day credentials..."
echo "   Expiry date: ${DISPLAY_DATE}"
echo ""

CRED_OUTPUT=$(az ad app credential reset \
  --id ${APP_ID} \
  --end-date "${END_DATE}" \
  --append \
  --output json 2>&1)

if [[ $? -ne 0 ]]; then
  echo ""
  echo "❌ Error adding credentials:"
  echo ""
  echo "$CRED_OUTPUT"
  echo ""
  
  if [[ "$CRED_OUTPUT" == *"Credential lifetime exceeds"* ]] || [[ "$CRED_OUTPUT" == *"max value allowed"* ]]; then
    echo "=================================================="
    echo "  ❌ Credential lifetime policy violation"
    echo "=================================================="
    echo ""
    echo "  Your organization's policy doesn't allow ${DAYS} days."
    echo ""
    echo "  Solutions:"
    echo "  1. Try a shorter duration (e.g., 7 or 14 days)"
    echo "  2. Contact your Azure AD administrator for exact policy limits"
  fi
  echo ""
  echo "Cleaning up..."
  az ad sp delete --id ${APP_ID} 2>/dev/null
  exit 1
fi

# Extract JSON from output (skip WARNING lines)
CRED_JSON=$(echo "$CRED_OUTPUT" | grep -A100 '^{' | sed '/^$/d')

# Validate credential output
if ! echo "$CRED_JSON" | jq . &>/dev/null; then
  echo "❌ Error: Failed to parse credential output"
  echo ""
  echo "Raw output:"
  echo "$CRED_OUTPUT"
  echo ""
  az ad sp delete --id ${APP_ID} 2>/dev/null
  exit 1
fi

# Extract credentials
CLIENT_ID=${APP_ID}
CLIENT_SECRET=$(echo "$CRED_JSON" | jq -r '.password')

echo "✓ Credentials added (expires: ${DISPLAY_DATE})"
echo ""

# Step 4: Assign Contributor role
echo "🔑 Step 4/4: Assigning Contributor role..."
echo ""

az role assignment create \
  --assignee ${APP_ID} \
  --role Contributor \
  --scope /subscriptions/${SUBSCRIPTION_ID} \
  --output none 2>&1

if [[ $? -ne 0 ]]; then
  echo "⚠️  Warning: Failed to assign Contributor role"
  echo "   You may need to assign permissions manually:"
  echo "   az role assignment create --assignee ${APP_ID} --role Contributor"
  echo ""
else
  echo "✓ Contributor role assigned"
  echo ""
fi

echo "✓ Credentials set to ${DAYS}-day lifetime"
echo ""

echo "✅ Service Principal setup complete!"
echo ""
echo "=================================================="
echo "IMPORTANT: Save these credentials securely!"
echo "=================================================="
echo ""
echo "Service Principal Name: ${SP_NAME}"
echo "Client ID (App ID):     ${CLIENT_ID}"
echo "Client Secret:          ${CLIENT_SECRET}"
echo "Tenant ID:              ${TENANT_ID}"
echo "Subscription ID:        ${SUBSCRIPTION_ID}"
echo "Expires On:             ${DISPLAY_DATE} (in ${DAYS} days)"
echo ""
echo "=================================================="
echo ""

# Create .env file
ENV_FILE="./infra/.env.sp"
echo "📝 Saving credentials to ${ENV_FILE}"
echo ""

cat > ${ENV_FILE} << EOF
# Azure Service Principal Credentials
# DO NOT commit this file to source control!
# EXPIRES ON: ${DISPLAY_DATE}

export AZURE_CLIENT_ID="${CLIENT_ID}"
export AZURE_CLIENT_SECRET="${CLIENT_SECRET}"
export AZURE_TENANT_ID="${TENANT_ID}"
export AZURE_SUBSCRIPTION_ID="${SUBSCRIPTION_ID}"
export USE_SERVICE_PRINCIPAL="true"

# Expiration tracking
export SP_NAME="${SP_NAME}"
export SP_EXPIRY_DATE="${DISPLAY_DATE}"
export SP_DAYS="${DAYS}"
EOF

chmod 600 ${ENV_FILE}

echo "✓ Credentials saved to ${ENV_FILE}"
echo ""
echo "=================================================="
echo "Usage Instructions:"
echo "=================================================="
echo ""
echo "1. For local deployments:"
echo "   source ${ENV_FILE}"
echo "   ./infra/deploy-container.sh"
echo ""
echo "2. For CI/CD pipelines:"
echo "   Set these as secrets:"
echo "   - AZURE_CLIENT_ID=${CLIENT_ID}"
echo "   - AZURE_CLIENT_SECRET=(secret value)"
echo "   - AZURE_TENANT_ID=${TENANT_ID}"
echo "   - USE_SERVICE_PRINCIPAL=true"
echo ""
echo "=================================================="
echo ""
echo "⚠️  IMPORTANT - Credential Expiration:"
echo "   ⏰ Credentials expire on: ${DISPLAY_DATE} (in ${DAYS} days)"
echo "   📅 Set a calendar reminder to rotate BEFORE this date!"
echo ""
echo "To rotate credentials before expiry:"
echo "  NEW_END_DATE=\$(date -u -d '+${DAYS} days' +'%Y-%m-%dT%H:%M:%SZ')"
echo "  az ad app credential reset --id ${CLIENT_ID} --end-date \"\$NEW_END_DATE\""
echo ""
echo "=================================================="
echo ""
