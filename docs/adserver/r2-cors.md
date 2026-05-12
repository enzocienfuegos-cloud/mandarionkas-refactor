# R2 CORS for Creative Uploads

Creative uploads use a direct browser `PUT` to Cloudflare R2 when the API can return a presigned URL. The API proxy remains as a fallback, but direct R2 upload avoids routing large files through DigitalOcean App Platform.

Apply this CORS policy to the active creative-assets bucket (`smx-assets-staging` in staging, production bucket in prod):

```json
[
  {
    "AllowedOrigins": [
      "https://app-staging.duskplatform.co",
      "https://portal-staging.duskplatform.co",
      "https://studio-staging.duskplatform.co",
      "https://app.duskplatform.co",
      "https://portal.duskplatform.co",
      "https://studio.duskplatform.co"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 300
  }
]
```

With Wrangler:

```bash
wrangler r2 bucket cors put smx-assets-staging --rules ./r2-cors.json
```

After changing the policy, verify from the browser that the upload request goes directly to the R2 endpoint with `PUT`, and that the fallback `/v1/creative-ingestions/:id/upload-proxy` path still works if `presignedUrl` is unavailable.
