# Compliance Portal - Azure Deployment

Complete infrastructure and deployment guide for the WCAG Compliance Portal using Docker containers on Azure App Service.

## 📁 Files

- **`main-container.bicep`** - Infrastructure as Code defining all Azure resources
- **`deploy-container.sh`** - Automated deployment script (creates everything from scratch)

## 🏗️ Infrastructure Components

The deployment creates the following Azure resources:

| Resource | Description | Configuration |
|----------|-------------|---------------|
| **Resource Group** | `compliance-portal-rg` | Container for all resources |
| **Container Registry** | Azure ACR | Stores Docker images |
| **App Service Plan** | B1 tier | 1 CPU, 1.75GB RAM, Linux |
| **App Service** | Web app | Docker container with Node.js 20 |
| **PostgreSQL** | Flexible Server v17 | Database with SSL |
| **Application Insights** | Monitoring | Logs and metrics |

## ⚡ Performance Optimizations

The deployment includes production-ready optimizations:

✅ **Pre-bundled Playwright browsers** (~285MB) - No installation on startup  
✅ **Health check endpoint** (`/api/health`) - Prevents cold starts  
✅ **Azure-optimized concurrency** - Auto-detects environment, reduces to 1 site/2 pages  
✅ **Database query optimization** - Eliminated 500+ redundant UPDATE queries (90% reduction)  
✅ **Container-optimized Chromium flags** - `--disable-dev-shm-usage`, `--no-sandbox`, etc.  
✅ **Reduced page wait times** - 100ms vs 2000ms  

**Expected scan performance:** 30-45 seconds for 10-15 pages

## 🚀 Quick Start

### Prerequisites

Before deploying, ensure you have:

1. **Azure CLI** installed and logged in
   ```bash
   az login
   az account set --subscription <your-subscription-id>
   ```

2. **Docker** installed and running
   ```bash
   docker --version
   # Should show Docker version 20.10 or higher
   ```

3. **Permissions** to create resources in your Azure subscription
   - Contributor or Owner role

### One-Command Deployment

```bash
cd compliance-portal
./infra/deploy-container.sh
```

This script will:
1. ✅ Create Azure resource group
2. ✅ Build Docker image with all dependencies
3. ✅ Deploy infrastructure (ACR, PostgreSQL, App Service)
4. ✅ Push Docker image to Azure Container Registry
5. ✅ Start the application
6. ✅ Run health check

**Deployment time:** ~8-10 minutes

## 📋 Detailed Steps

### Step 1: Configure Deployment (Optional)

Edit `deploy-container.sh` to customize settings:

```bash
RESOURCE_GROUP="compliance-portal-rg"      # Change resource group name
LOCATION="centralus"                        # Change Azure region
POSTGRES_ADMIN_USER="pgadmin"              # Change database username
POSTGRES_ADMIN_PASSWORD="P@ssw0rd123!"    # Change database password (use strong password!)
```

### Step 2: Run Deployment

```bash
cd /path/to/compliance-portal
chmod +x infra/deploy-container.sh
./infra/deploy-container.sh
```

### Step 3: Monitor Progress

The script outputs progress for each step:

```
🚀 Starting containerized deployment to Azure...

📁 Step 1: Creating resource group...
✓ Resource group ready

📦 Step 2: Building Docker image...
✓ Docker image built successfully

🏗️  Step 3: Deploying Azure infrastructure...
✓ Infrastructure deployed

🔐 Step 4: Logging into Azure Container Registry...
✓ Logged into ACR

📤 Step 5: Pushing image to Azure Container Registry...
✓ Image pushed to ACR

🔄 Step 6: Restarting App Service...
✓ App Service restarted

⏳ Step 7: Waiting for application to start (60 seconds)...
🧪 Testing application...
✅ Deployment successful!
```

### Step 4: Access Your Application

After successful deployment:

```
🌐 Application URL: https://<app-name>.azurewebsites.net
```

Open this URL in your browser to access the portal.

## 🔧 Manual Deployment (Advanced)

If you prefer manual control:

### 1. Create Resource Group

```bash
az group create \
  --name compliance-portal-rg \
  --location centralus
```

### 2. Build Docker Image

```bash
cd compliance-portal
docker build -t compliance-portal:latest .
```

The Docker build:
- Installs all npm dependencies
- Pre-installs Playwright Chromium browser (~285MB)
- Compiles TypeScript to JavaScript
- Builds React frontend with Vite
- Creates optimized production image

### 3. Deploy Infrastructure

```bash
az deployment group create \
  --resource-group compliance-portal-rg \
  --template-file infra/main-container.bicep \
  --parameters \
    postgresAdminUsername="pgadmin" \
    postgresAdminPassword="YourStrongPassword123!" \
    dockerImageTag="latest"
```

**Important:** Change the password to a strong, unique password!

This creates:
- Azure Container Registry (ACR)
- PostgreSQL Flexible Server
- App Service Plan (B1 tier)
- App Service (configured for Docker)
- Application Insights

### 4. Push Image to ACR

```bash
# Get ACR name from deployment
ACR_NAME=$(az deployment group show \
  --resource-group compliance-portal-rg \
  --name main-container \
  --query 'properties.outputs.containerRegistryName.value' \
  --output tsv)

# Login to ACR
az acr login --name ${ACR_NAME}

# Tag and push image
docker tag compliance-portal:latest ${ACR_NAME}.azurecr.io/compliance-portal:latest
docker push ${ACR_NAME}.azurecr.io/compliance-portal:latest
```

### 5. Restart App Service

```bash
APP_NAME=$(az deployment group show \
  --resource-group compliance-portal-rg \
  --name main-container \
  --query 'properties.outputs.appServiceName.value' \
  --output tsv)

az webapp restart \
  --resource-group compliance-portal-rg \
  --name ${APP_NAME}
```

### 6. Verify Deployment

```bash
# Get app URL
APP_URL=$(az deployment group show \
  --resource-group compliance-portal-rg \
  --name main-container \
  --query 'properties.outputs.appServiceUrl.value' \
  --output tsv)

# Test health endpoint
curl ${APP_URL}/api/health

# Expected output: {"status":"ok","timestamp":"..."}
```

## 🔄 Updating the Application

To deploy code changes:

```bash
# 1. Rebuild Docker image
docker build -t compliance-portal:latest .

# 2. Push to ACR (ACR_NAME from previous deployment)
docker tag compliance-portal:latest ${ACR_NAME}.azurecr.io/compliance-portal:latest
docker push ${ACR_NAME}.azurecr.io/compliance-portal:latest

# 3. Restart app (pulls latest image)
az webapp restart --resource-group compliance-portal-rg --name ${APP_NAME}
```

Or simply run: `./infra/deploy-container.sh` (skips infrastructure creation if it exists)

## ⚙️ Configuration Options

### Environment Variables

The Bicep template configures these environment variables:

| Variable | Value | Purpose |
|----------|-------|---------|
| `NODE_ENV` | `production` | Enables production mode |
| `WEBSITES_PORT` | `8080` | App listens on port 8080 |
| `WEBSITES_ENABLE_APP_SERVICE_STORAGE` | `false` | Use container filesystem |
| `PGHOST` | Auto-set | PostgreSQL hostname |
| `PGDATABASE` | `compliancedb` | Database name |
| `PGUSER` | Auto-set | Database username |
| `PGPASSWORD` | Auto-set | Database password |
| `PGSSLMODE` | `require` | Enforce SSL connections |

### Customizing Bicep Parameters

Edit values in `deploy-container.sh` or pass directly to `az deployment group create`:

```bash
--parameters \
  postgresAdminUsername="myuser" \
  postgresAdminPassword="MyP@ssw0rd!" \
  dockerImageTag="v1.0.0" \
  appServiceSku="B2" \
  location="eastus"
```

Available SKUs:
- **B1** (1 core, 1.75GB RAM) - Development/Testing - ~$13/month
- **B2** (2 cores, 3.5GB RAM) - Production - ~$26/month
- **S1** (1 core, 1.75GB RAM) - Production with staging slots - ~$73/month

## 🐛 Troubleshooting

### Deployment Fails

**Error: Resource group not found**
```bash
# Ensure you created the resource group first
az group create --name compliance-portal-rg --location centralus
```

**Error: Quota exceeded**
```bash
# Check your subscription limits
az vm list-usage --location centralus --output table
```

**Error: Docker build fails**
```bash
# Clear Docker cache and rebuild
docker builder prune -af
docker build -t compliance-portal:latest . --no-cache
```

### Application Not Starting

**Check logs:**
```bash
az webapp log tail \
  --resource-group compliance-portal-rg \
  --name ${APP_NAME}
```

**Common issues:**

1. **Container fails health check**
   - Wait 2-3 minutes for initial startup
   - Check if Playwright browsers are installed in image
   - Verify port 8080 is configured

2. **Database connection errors**
   - Verify PostgreSQL firewall allows Azure services
   - Check PGPASSWORD environment variable is set
   - Ensure SSL is enabled (`PGSSLMODE=require`)

3. **Playwright browser errors**
   - Image should pre-bundle browsers (~285MB)
   - Check Dockerfile has `RUN npx playwright install chromium --with-deps`
   - Verify environment variable `PLAYWRIGHT_BROWSERS_PATH` is set

### Slow Scan Performance

Expected: 30-45 seconds for 10-15 pages

If scans are slow (>2 minutes):

1. **Check environment detection:**
   ```bash
   az webapp log tail --resource-group compliance-portal-rg --name ${APP_NAME} | grep "Azure environment"
   
   # Should show: "Azure environment detected - optimizing concurrency (site: X→1, page: Y→2)"
   ```

2. **Verify database optimization:**
   - Audit log updates should be commented out in code
   - Check for excessive database queries in logs

3. **Consider upgrading App Service tier:**
   ```bash
   az appservice plan update \
     --resource-group compliance-portal-rg \
     --name <plan-name> \
     --sku B2  # 2 cores instead of 1
   ```

## 📊 Monitoring

### View Application Logs

```bash
# Stream logs in real-time
az webapp log tail \
  --resource-group compliance-portal-rg \
  --name ${APP_NAME}

# Download logs
az webapp log download \
  --resource-group compliance-portal-rg \
  --name ${APP_NAME} \
  --log-file app-logs.zip
```

### Check Application Insights

```bash
# Get Application Insights connection string
az deployment group show \
  --resource-group compliance-portal-rg \
  --name main-container \
  --query 'properties.outputs.applicationInsightsConnectionString.value'
```

View metrics in Azure Portal → Application Insights → Performance

### Database Metrics

```bash
# Check PostgreSQL metrics
az postgres flexible-server show \
  --resource-group compliance-portal-rg \
  --name ${PG_SERVER_NAME} \
  --query "{Status:state,Version:version,Storage:storage.storageSizeGb}"
```

## 🗑️ Cleanup

To delete all resources and stop incurring charges:

```bash
az group delete \
  --name compliance-portal-rg \
  --yes \
  --no-wait
```

This removes:
- App Service
- Container Registry (and all images)
- PostgreSQL database (⚠️ data will be deleted)
- Application Insights
- All other resources in the group

## 📚 Additional Resources

- [Dockerfile](../Dockerfile) - Multi-stage Docker build configuration
- [Bicep Template](main-container.bicep) - Complete infrastructure definition
- [Deployment Script](deploy-container.sh) - Automated deployment
- [Project README](../README.md) - Application overview
- [Azure App Service Docs](https://learn.microsoft.com/azure/app-service/)
- [Azure Container Registry Docs](https://learn.microsoft.com/azure/container-registry/)

## 🆘 Getting Help

If you encounter issues:

1. Check the troubleshooting section above
2. Review deployment logs: `tail -50 /tmp/complete-deploy.log`
3. Check application logs: `az webapp log tail`
4. Verify all prerequisites are installed
5. Ensure you have proper Azure permissions

## 🎯 Quick Reference

```bash
# Deploy from scratch
./infra/deploy-container.sh

# Update application code
docker build -t compliance-portal:latest .
docker push ${ACR_NAME}.azurecr.io/compliance-portal:latest
az webapp restart --resource-group compliance-portal-rg --name ${APP_NAME}

# View logs
az webapp log tail --resource-group compliance-portal-rg --name ${APP_NAME}

# Test health
curl https://${APP_NAME}.azurewebsites.net/api/health

# Delete everything
az group delete --name compliance-portal-rg --yes
```
