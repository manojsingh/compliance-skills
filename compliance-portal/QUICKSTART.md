# Azure Deployment - Quick Start Guide

## 🚀 Deploy to Azure in 5 Minutes

This quick start guide will get your Compliance Portal running on Azure App Service with PostgreSQL.

### Prerequisites Checklist

- [ ] Azure subscription ([Get one free](https://azure.microsoft.com/free/))
- [ ] Azure CLI installed ([Install](https://docs.microsoft.com/cli/azure/install-azure-cli))
- [ ] Node.js 20+ installed
- [ ] Git (for CI/CD setup)

### Step 1: Clone and Prepare (2 min)

```bash
cd compliance-portal
cp server/.env.example server/.env
```

### Step 2: Login to Azure (1 min)

```bash
az login
az account list --output table
az account set --subscription "Your-Subscription-Name"
```

### Step 3: Deploy Infrastructure (2 min)

```bash
cd infra
chmod +x deploy.sh

# Set variables
export RESOURCE_GROUP="compliance-portal-rg"
export LOCATION="centralus"
export POSTGRES_PASSWORD="YourSecurePass123!"

# Deploy!
./deploy.sh
```

The script will:
- ✅ Create resource group
- ✅ Deploy App Service (Node.js 20)
- ✅ Deploy PostgreSQL Flexible Server
- ✅ Configure Managed Identity
- ✅ Set up Application Insights
- ✅ Deploy your application

### Step 4: Access Your App

After deployment completes, you'll see:

```
=== Deployment Complete! ===
Application URL: https://azappXXXX.azurewebsites.net

Next steps:
1. Run database migrations
2. Configure frontend
3. Set up custom domain (optional)
```

Visit the URL to see your running application!

## Database Migration (If Migrating from SQLite)

If you have existing data in SQLite:

```bash
# Set environment variables for PostgreSQL
export PGHOST=<your-server>.postgres.database.azure.com
export PGDATABASE=compliancedb
export PGUSER=pgadmin
export PGPASSWORD=<your-password>
export PGSSLMODE=require

# Run migration
cd server
tsx scripts/migrate-to-postgres.ts
```

## Configuration Options

### Using Managed Identity (Recommended for Production)

During deployment, choose "yes" when asked about passwordless connection:

```
Do you want to set up passwordless (managed identity) connection? (y/N) y
```

This configures:
- Azure Managed Identity
- Service Connector for PostgreSQL
- Automatic token rotation

### Using Connection String (Simpler for Dev/Test)

Choose "no" for passwordless, and the script will use traditional credentials.

## Monitoring Your App

### View Logs

```bash
# Stream live logs
az webapp log tail \
  --name <app-name> \
  --resource-group compliance-portal-rg

# Or view in Azure Portal
# Navigate to: App Service > Monitoring > Log stream
```

### Application Insights

View performance metrics:
1. Open [Azure Portal](https://portal.azure.com)
2. Navigate to your Resource Group
3. Click on Application Insights resource
4. View Live Metrics, Performance, Failures

## Frontend Deployment

### Option 1: Serve from Same App Service

Update `server/src/app.ts` to serve static files:

```typescript
import express from 'express';
import path from 'path';

// ... existing code ...

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../../client/dist')));

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});
```

Then rebuild and deploy.

### Option 2: Deploy to Azure Static Web Apps (Recommended)

```bash
cd client
npm run build

# Create Static Web App
az staticwebapp create \
  --name compliance-portal-frontend \
  --resource-group compliance-portal-rg \
  --source ./dist \
  --location centralus \
  --branch main

# Update backend CORS to allow frontend domain
# (edit infra/main.bicep and redeploy)
```

## Cost Estimate

| Resource | Tier | Monthly Cost |
|----------|------|--------------|
| App Service | B1 (Basic) | ~$13 |
| PostgreSQL | Burstable B1ms | ~$12 |
| Application Insights | Pay-as-you-go | ~$2-5 |
| **Total** | | **~$27-30** |

💡 **Tip**: Use Burstable tier for dev/test. Scale to General Purpose for production.

## Common Issues

### Issue: Playwright not working

**Solution**: Ensure `playwright install` runs during deployment:
- Check `package.json` has `postinstall` script
- Verify Linux App Service Plan is used
- Check App Service logs for installation errors

### Issue: Database connection fails

**Solution**: 
1. Verify firewall rules: Azure Services should be allowed
2. Check environment variables are set correctly
3. For managed identity: ensure Service Connector is configured
4. Test connection: `az postgres flexible-server connect -n <server> -u <user>`

### Issue: App crashes on startup

**Solution**:
1. Check logs: `az webapp log tail`
2. Verify Node.js version: Should be 20+
3. Ensure all dependencies are installed
4. Check environment variables are set

## Next Steps

Now that your app is deployed:

1. **Set up CI/CD**: Use the included GitHub Actions workflow
   - Add `AZURE_WEBAPP_PUBLISH_PROFILE` secret to GitHub
   - Push to main branch to auto-deploy

2. **Custom Domain**: Configure your own domain
   ```bash
   az webapp config hostname add \
     --webapp-name <app-name> \
     --resource-group compliance-portal-rg \
     --hostname yourdomain.com
   ```

3. **SSL Certificate**: App Service provides free SSL
   - Go to Azure Portal > App Service > TLS/SSL settings
   - Add custom domain and enable SSL

4. **Scaling**: Configure auto-scaling rules
   ```bash
   az monitor autoscale create \
     --resource-group compliance-portal-rg \
     --resource <app-service-plan> \
     --min-count 1 \
     --max-count 5 \
     --count 2
   ```

5. **Backups**: PostgreSQL has automatic backups (7 days retention)
   - Configure long-term backup if needed
   - Test restore procedure

## Support

- **Full Documentation**: See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Migration Guide**: See [docs/MIGRATION_GUIDE.md](./docs/MIGRATION_GUIDE.md)
- **Azure Support**: [https://azure.microsoft.com/support/](https://azure.microsoft.com/support/)

## Clean Up Resources

When done testing, remove all resources:

```bash
az group delete \
  --name compliance-portal-rg \
  --yes \
  --no-wait
```

---

**Need help?** Check the full [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.
