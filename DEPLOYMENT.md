# PaperTrace Deployment Guide

This guide covers deploying PaperTrace to production on Vercel and preparing the browser extension for distribution.

## Quick Start Deployment

### 1. Deploy to Vercel (Recommended)

The easiest way to deploy PaperTrace is through Vercel:

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Deploy from project root
vercel
```

Follow the prompts:
- Link to your GitHub account (optional but recommended)
- Confirm project name
- Select framework: **Next.js**
- Accept default build settings

Your app will be live at `https://<project-name>.vercel.app`

### 2. Update Extension Configuration

Once deployed, update the extension to use your production URL:

**File: `/extension/popup.js`**
```javascript
// Change from:
const API_ENDPOINT = "http://localhost:3000/api/analyze";
const FULL_APP_URL = "http://localhost:3000";

// To:
const API_ENDPOINT = "https://your-domain.vercel.app/api/analyze";
const FULL_APP_URL = "https://your-domain.vercel.app";
```

**File: `/extension/options.html`**
```html
<!-- Update the placeholder -->
<input
  type="text"
  id="apiUrl"
  placeholder="https://your-domain.vercel.app/api/analyze"
/>
```

## Alternative Deployment Methods

### Docker Deployment

For containerized deployment:

```bash
# Build Docker image
docker build -t papertrace .

# Run container
docker run -p 3000:3000 papertrace
```

**Dockerfile:**
```dockerfile
FROM node:18-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

### Self-Hosted (VPS/EC2)

1. **SSH into your server:**
   ```bash
   ssh user@your-server.com
   ```

2. **Install Node.js:**
   ```bash
   curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Clone and deploy:**
   ```bash
   cd /opt
   git clone https://github.com/your-repo/papertrace.git
   cd papertrace
   npm install
   npm run build
   npm start
   ```

4. **Use PM2 for process management:**
   ```bash
   npm install -g pm2
   pm2 start npm --name papertrace -- start
   pm2 save
   ```

5. **Set up Nginx reverse proxy:**
   ```nginx
   server {
       listen 80;
       server_name papertrace.yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## Environment Variables

PaperTrace doesn't require environment variables for basic operation (uses in-memory cache), but you may want to add:

```bash
# Optional: for analytics or monitoring
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production
```

## Browser Extension Distribution

### For Chrome Web Store

1. **Prepare files:**
   - Navigate to `/extension` folder
   - Create a ZIP: `papertrace-extension.zip`
   - Include only necessary files:
     ```
     manifest.json
     popup.html
     popup.js
     content.js
     background.js
     options.html
     options.js
     ```

2. **Create Chrome Web Store account:**
   - Visit [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Pay one-time $5 registration fee
   - Create new item

3. **Upload extension:**
   - Select "ZIP file containing your extension"
   - Upload `papertrace-extension.zip`
   - Fill in details:
     - Name: PaperTrace
     - Description: "Analyze research papers for integrity issues"
     - Category: Productivity
     - Language: English

4. **Add store listing:**
   - Upload icon (128x128px)
   - Add screenshots (1280x800px)
   - Add detailed description
   - Review permissions

5. **Submit for review:**
   - Google typically reviews within 24-72 hours
   - Once approved, it's live on Chrome Web Store!

### For Firefox Add-ons

1. **Create manifest.json variant:**
   - Firefox uses slightly different manifest format
   - Create `manifest-firefox.json` with adjustments for Firefox

2. **Submit to Mozilla Add-ons:**
   - Visit [addons.mozilla.org](https://addons.mozilla.org)
   - Create developer account
   - Submit extension
   - Same review process, typically 3-5 days

### Manual Installation (Development)

Users can install locally:

1. Download the `/extension` folder
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the extension folder
6. Grant permissions when prompted

## Performance Optimization

### Caching Strategy

The app uses in-memory caching. For production with high traffic, consider adding Redis:

```typescript
// lib/cache.ts
import { createClient } from 'redis';

const cache = createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
});

export async function getCachedAnalysis(key: string) {
  return cache.get(key);
}

export async function cacheAnalysis(key: string, data: any) {
  cache.set(key, JSON.stringify(data), 'EX', 3600);
}
```

### Database Integration (Optional)

To persist analysis results, integrate with a database:

```typescript
// lib/db.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export async function saveAnalysis(report: AnalysisReport) {
  const { data, error } = await supabase
    .from('analyses')
    .insert([report]);
  
  if (error) console.error(error);
  return data;
}
```

## Monitoring & Analytics

### Basic Monitoring

Set up error tracking with Sentry:

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

### Performance Metrics

Monitor API response times:

```typescript
// app/api/analyze/route.ts
const start = performance.now();
const result = await analyzePaper(data);
const duration = performance.now() - start;

console.log(`Analysis completed in ${duration}ms`);
```

## Scalability Considerations

- **Load Balancing:** Vercel handles this automatically
- **Database:** Use managed Postgres (Supabase/Neon) for scale
- **Caching:** Implement Redis for frequently analyzed papers
- **CDN:** Vercel includes built-in CDN for static assets
- **Rate Limiting:** Add per-IP/user rate limiting

```typescript
// middleware.ts
import { rateLimit } from '@/lib/rateLimit';

export async function middleware(request: NextRequest) {
  const ip = request.ip || 'unknown';
  const { success } = await rateLimit(ip);
  
  if (!success) {
    return new NextResponse('Rate limited', { status: 429 });
  }
}
```

## Troubleshooting Deployment

### Extension not communicating with deployed API

1. Check CORS headers in your API
2. Verify API URL in extension settings
3. Check browser console for errors
4. Ensure API is accessible from extension origin

### Slow analysis times

1. Check if analysis cache is working
2. Monitor API response times
3. Consider optimizing detection algorithms
4. Implement database caching for repeated analyses

### Memory issues

1. Implement request/response streaming for large papers
2. Clean up in-memory cache periodically
3. Monitor memory usage with `node --max-old-space-size`

## Maintenance

### Regular Tasks

- Monitor error logs weekly
- Review performance metrics monthly
- Update dependencies quarterly
- Backup any persistent data (if using database)

### Update Procedure

1. Test locally: `npm run dev`
2. Run tests: `npm test`
3. Build: `npm run build`
4. Deploy: `vercel`
5. Update extension if needed
6. Notify users of changes

## Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Chrome Web Store Guidelines](https://developer.chrome.com/docs/webstore/)
- [Firefox Add-ons Developer Guide](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions)

---

**Happy deploying!** 🚀
