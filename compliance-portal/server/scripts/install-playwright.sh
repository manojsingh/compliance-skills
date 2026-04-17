#!/bin/bash
# Post-deployment script to configure Playwright on Azure App Service

echo "Installing Playwright browsers..."

# Install Chromium with dependencies
npx playwright install chromium --with-deps

# Set permissions
chmod -R 755 node_modules/playwright-core/.local-browsers || true

echo "Playwright installation complete!"
echo "Browser path: $(pwd)/node_modules/playwright-core/.local-browsers"
