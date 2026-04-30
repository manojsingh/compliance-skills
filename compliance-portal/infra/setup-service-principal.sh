#!/bin/bash
# Setup Azure Service Principal for CI/CD deployments
# This prevents token expiry issues during long-running deployments

set -e

echo "🔧 Azure Service Principal Setup"
echo "================================"
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

# Ask for credential lifetime (years)
echo ""
echo "⏱️  Credential Lifetime:"
echo "   Your organization may have policies limiting credential lifetime."
read -p "Enter credential lifetime in years (default: 1, max typically 1-2): " YEARS
YEARS=${YEARS:-1}

echo ""
echo "🔑 Creating service principal..."
echo "   Name: ${SP_NAME}"
echo "   Credential lifetime: ${YEARS} year(s)"
echo "   This may take a moment..."
echo ""

# Create service principal with Contributor role and specified lifetime
# Capture both stdout and stderr
SP_OUTPUT=$(az ad sp create-for-rbac \
  --name "${SP_NAME}" \
  --role Contributor \
  --scopes /subscriptions/${SUBSCRIPTION_ID} \
  --years ${YEARS} \
  --output json 2>&1)

EXIT_CODE=$?

# Check if creation failed due to policy
if [[ $EXIT_CODE -ne 0 ]]; then
  echo ""
  echo "❌ Error creating service principal:"
  echo ""
  echo "$SP_OUTPUT"
  echo ""
  echo "=================================================="
  echo "Troubleshooting:"
  echo "=================================================="
  
  if [[ "$SP_OUTPUT" == *"Credential lifetime exceeds"* ]] || [[ "$SP_OUTPUT" == *"max value allowed"* ]]; then
    echo "  ❌ Credential lifetime policy violation"
    echo ""
    echo "     Your organization has a policy limiting credential lifetime."
    echo ""
    echo "     Solutions:"
    echo "     1. Use the strict policy script instead:"
    echo "        ./infra/setup-service-principal-strict.sh"
    echo ""
    echo "     2. Contact your Azure AD administrator for:"
    echo "        - Current credential lifetime policy limits"
    echo "        - Creating a service principal with approved credentials"
  elif [[ "$SP_OUTPUT" == *"already exists"* ]]; then
    echo "  ❌ Service principal with this name already exists"
    echo ""
    echo "     Delete the existing one first:"
    echo "     APP_ID=\$(az ad sp list --display-name '${SP_NAME}' --query '[0].appId' -o tsv)"
    echo "     az ad sp delete --id \$APP_ID"
  elif [[ "$SP_OUTPUT" == *"insufficient privileges"* ]] || [[ "$SP_OUTPUT" == *"Forbidden"* ]]; then
    echo "  ❌ Insufficient permissions"
    echo ""
    echo "     You need permission to create service principals in Azure AD."
    echo "     Contact your Azure AD administrator."
  else
    echo "  - Check the error message above"
    echo "  - Try ./infra/setup-service-principal-strict.sh for day-based policies"
    echo "  - Verify you have permissions to create service principals"
  fi
  echo ""
  exit 1
fi

# Validate JSON output
if ! echo "$SP_OUTPUT" | jq . &>/dev/null; then
  echo ""
  echo "❌ Error: Failed to parse service principal output"
  echo ""
  echo "Raw output:"
  echo "$SP_OUTPUT"
  echo ""
  exit 1
fi

# Extract credentials
CLIENT_ID=$(echo $SP_OUTPUT | jq -r '.appId')
CLIENT_SECRET=$(echo $SP_OUTPUT | jq -r '.password')
TENANT_ID=$(echo $SP_OUTPUT | jq -r '.tenant')

echo "✅ Service Principal created successfully!"
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
echo ""
echo "=================================================="
echo ""

# Create .env file for local use
ENV_FILE="./infra/.env.sp"
echo "📝 Saving credentials to ${ENV_FILE}"
echo "   (Add this file to .gitignore - DO NOT commit!)"
echo ""

cat > ${ENV_FILE} << EOF
# Azure Service Principal Credentials
# DO NOT commit this file to source control!

export AZURE_CLIENT_ID="${CLIENT_ID}"
export AZURE_CLIENT_SECRET="${CLIENT_SECRET}"
export AZURE_TENANT_ID="${TENANT_ID}"
export AZURE_SUBSCRIPTION_ID="${SUBSCRIPTION_ID}"
export USE_SERVICE_PRINCIPAL="true"
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
echo "2. For CI/CD pipelines (GitHub Actions, Azure DevOps):"
echo "   Set these as secrets/variables:"
echo "   - AZURE_CLIENT_ID"
echo "   - AZURE_CLIENT_SECRET"
echo "   - AZURE_TENANT_ID"
echo "   - USE_SERVICE_PRINCIPAL=true"
echo ""
echo "3. To test the service principal:"
echo "   az login --service-principal \\"
echo "     --username ${CLIENT_ID} \\"
echo "     --password '***' \\"
echo "     --tenant ${TENANT_ID}"
echo ""
echo "=================================================="
echo ""
echo "⚠️  Security Notes:"
echo "   - Credentials expire in ${YEARS} year(s) - mark your calendar!"
echo "   - Store credentials securely (Azure Key Vault, GitHub Secrets, etc.)"
echo "   - Rotate credentials before expiry using: az ad sp credential reset"
echo "   - Use separate service principals for dev/staging/prod"
echo "   - Consider using managed identities when running in Azure"
echo ""
echo "💡 To rotate credentials later (before expiry):"
echo "   az ad sp credential reset --id ${CLIENT_ID} --years ${YEARS}"
echo ""
