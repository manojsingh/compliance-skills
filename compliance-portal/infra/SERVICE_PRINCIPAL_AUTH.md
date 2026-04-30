# Service Principal Authentication for Azure Deployments

## Problem

Azure CLI user authentication tokens can expire during long-running deployments, especially when:
- Building large Docker images (5-10 minutes)
- Pushing images to Azure Container Registry (2-5 minutes)
- Deploying complex infrastructure (3-5 minutes)

**Total deployment time: 10-20 minutes** - exceeding typical token lifetimes (2-5 minutes for MFA-enforced accounts).

This causes deployment failures with errors like:
```
ERROR: authentication token expired
ERROR: failed to push image: unauthorized
```

## Solution

Use **Azure Service Principal** authentication instead of user tokens. Service principals:
- ✅ Don't expire during deployment
- ✅ Work reliably in CI/CD pipelines
- ✅ Can be scoped with specific permissions
- ✅ Support automated/unattended deployments

---

## Quick Start

### 1. Create Service Principal

Run the setup script to create a service principal and save credentials:

```bash
cd /home/manojsingh/projects/compliance-skills/compliance-portal
chmod +x infra/setup-service-principal.sh
./infra/setup-service-principal.sh
```

This will:
1. Create a service principal with Contributor role
2. Save credentials to `infra/.env.sp` (excluded from git)
3. Display the credentials (save them securely!)

### 2. Deploy Using Service Principal

**Option A: Source the .env file**
```bash
source infra/.env.sp
./infra/deploy-container.sh
```

**Option B: Export variables manually**
```bash
export AZURE_CLIENT_ID="<your-client-id>"
export AZURE_CLIENT_SECRET="<your-client-secret>"
export AZURE_TENANT_ID="<your-tenant-id>"
export USE_SERVICE_PRINCIPAL="true"

./infra/deploy-container.sh
```

**Option C: Inline (one-time use)**
```bash
AZURE_CLIENT_ID="xxx" \
AZURE_CLIENT_SECRET="yyy" \
AZURE_TENANT_ID="zzz" \
USE_SERVICE_PRINCIPAL="true" \
./infra/deploy-container.sh
```

---

## CI/CD Pipeline Setup

### GitHub Actions

Add these secrets to your repository (Settings → Secrets):

```yaml
name: Deploy to Azure
on: [push]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy with Service Principal
        env:
          AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
          AZURE_CLIENT_SECRET: ${{ secrets.AZURE_CLIENT_SECRET }}
          AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
          USE_SERVICE_PRINCIPAL: "true"
        run: |
          cd compliance-portal
          ./infra/deploy-container.sh
```

### Azure DevOps

Add these variables to your pipeline:

```yaml
variables:
  - group: azure-credentials  # Variable group with SP credentials

steps:
  - script: |
      export AZURE_CLIENT_ID=$(AZURE_CLIENT_ID)
      export AZURE_CLIENT_SECRET=$(AZURE_CLIENT_SECRET)
      export AZURE_TENANT_ID=$(AZURE_TENANT_ID)
      export USE_SERVICE_PRINCIPAL="true"
      cd compliance-portal
      ./infra/deploy-container.sh
    displayName: 'Deploy to Azure'
```

---

## Manual Service Principal Creation

If you prefer to create the service principal manually:

```bash
# Login to Azure
az login

# Get your subscription ID
az account show --query id -o tsv

# Create service principal
az ad sp create-for-rbac \
  --name "compliance-portal-sp" \
  --role Contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>
```

This outputs:
```json
{
  "appId": "<CLIENT_ID>",
  "password": "<CLIENT_SECRET>",
  "tenant": "<TENANT_ID>"
}
```

Save these values securely!

---

## Verification

Test the service principal authentication:

```bash
# Login with service principal
az login --service-principal \
  --username <CLIENT_ID> \
  --password <CLIENT_SECRET> \
  --tenant <TENANT_ID>

# Verify access
az account show
az group list
```

---

## Security Best Practices

### ✅ DO:
- Store credentials in Azure Key Vault, GitHub Secrets, or secure CI/CD variables
- Use separate service principals for dev/staging/prod environments
- Rotate credentials regularly (every 90 days)
- Limit service principal permissions to specific resource groups
- Add credentials to `.gitignore`

### ❌ DON'T:
- Commit service principal credentials to source control
- Share credentials via email or chat
- Use the same service principal across environments
- Grant broader permissions than needed

---

## Troubleshooting

### "Credential lifetime exceeds the max value allowed"

Your Azure AD has a policy restricting service principal credential lifetime. This is a security policy set by your organization.

**Solution 1: Use shorter lifetime**

The setup script now asks for credential lifetime. Try with 1 year or less:

```bash
./infra/setup-service-principal.sh
# When prompted, enter 1 (or less)
```

**Solution 2: Create with specific end date**

For organizations with strict policies (e.g., 90-day maximum):

```bash
# Calculate end date (90 days from now)
END_DATE=$(date -d "+90 days" +%Y-%m-%d)

# Create service principal
SP_OUTPUT=$(az ad sp create-for-rbac \
  --name "compliance-portal-sp" \
  --role Contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID> \
  --end-date $END_DATE \
  --output json)
```

**Solution 3: Ask your Azure AD admin**

Contact your Azure AD administrator to:
- Get the exact credential lifetime policy limit
- Request an exception for deployment automation
- Create the service principal with approved credentials

**Note:** You'll need to rotate credentials before they expire using:
```bash
az ad sp credential reset --id <CLIENT_ID> --end-date <NEW_END_DATE>
```

### "az: command not found"
```bash
# Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

### "Service principal authentication failed"
```bash
# Verify credentials are set
echo $AZURE_CLIENT_ID
echo $AZURE_TENANT_ID

# Test login manually
az login --service-principal \
  --username $AZURE_CLIENT_ID \
  --password $AZURE_CLIENT_SECRET \
  --tenant $AZURE_TENANT_ID
```

### "Access has been blocked by Conditional Access policies" (AADSTS53003)

Some organizations have Conditional Access policies that block service principal logins for security reasons. **This is okay** - the deployment script has been updated to handle this scenario.

**How it works:**
1. Service principal login attempt fails due to Conditional Access → Script continues
2. Your user account is used for Azure resource operations (create/update resources)
3. Service principal is used ONLY for ACR (Azure Container Registry) authentication
4. This prevents token expiry during long Docker push operations (the main problem we're solving)

**Verification:**
```bash
# Source service principal credentials
source infra/.env.sp

# Run deployment (will use hybrid authentication)
./infra/deploy-container.sh
```

The script output will show:
```
⚠️  Service Principal login failed (likely Conditional Access policy)
   Will use your user account for Azure operations
   Service Principal will still be used for ACR authentication
```

**Note:** If ACR authentication also fails with Conditional Access, you may need to:
1. Contact your Azure AD admin to whitelist ACR authentication
2. Use an admin-managed service principal with Conditional Access exemptions
3. Deploy from a trusted network/device that passes Conditional Access checks

### "Insufficient permissions"
The service principal needs **Contributor** role on the subscription or resource group:

```bash
az role assignment create \
  --assignee <CLIENT_ID> \
  --role Contributor \
  --scope /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<RESOURCE_GROUP>
```

---

## Fallback to User Authentication

The deployment script automatically falls back to user authentication if service principal credentials aren't provided:

```bash
# Regular user login
az login

# Deploy (will use your user session)
./infra/deploy-container.sh
```

⚠️ **Note:** User sessions may still expire during long deployments. Service principal is recommended for production deployments.

---

## Additional Resources

- [Azure Service Principals Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/app-objects-and-service-principals)
- [Azure CLI Authentication](https://docs.microsoft.com/en-us/cli/azure/authenticate-azure-cli)
- [GitHub Actions Azure Login](https://github.com/marketplace/actions/azure-login)
