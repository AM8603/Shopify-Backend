# Shopify Order Backend

Secure backend for processing Shopify orders without exposing API tokens.

## Environment Variables Required:
- SHOPIFY_ACCESS_TOKEN: Your Shopify private app access token
- SHOP_DOMAIN: Your shop domain (e.g., your-shop.myshopify.com)

## API Endpoints:
- POST /api/create-order - Create new order
- GET /api/health - Health check

## Deployment:
This project is configured for Vercel deployment.