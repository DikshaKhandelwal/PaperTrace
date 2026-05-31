# PaperTrace Quick Start Guide

Get PaperTrace up and running in 5 minutes.

## Option 1: Local Development (5 minutes)

### Step 1: Install & Run
```bash
# Clone/enter the project
cd papertrace

# Install dependencies
npm install

# Start dev server
npm run dev
```

Server starts at `http://localhost:3000` 🎉

### Step 2: Test the Web App
1. Open http://localhost:3000 in browser
2. Click "Or enter details manually"
3. Fill in a test paper:
   - Title: "AI Advances in Medicine"
   - Authors: "Smith, Johnson"
   - Year: 2024
   - Abstract: "This paper presents novel findings"
   - Full Text: "Our research shows significant improvements"
4. Click "Analyze Paper"
5. Review the results!

### Step 3: Load Browser Extension (Optional)
1. Go to `chrome://extensions/`
2. Enable "Developer mode" (toggle, top right)
3. Click "Load unpacked"
4. Select the `/extension` folder
5. Done! Extension is now active

## Option 2: Deploy to Vercel (3 minutes)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Follow prompts and your app is live! Get the URL from deployment confirmation.

## Option 3: Docker (5 minutes)

```bash
# Build image
docker build -t papertrace .

# Run container
docker run -p 3000:3000 papertrace
```

Open http://localhost:3000

## What to Try Next

### 1. Test Different Scenarios
```
✓ Upload with drag-and-drop area
✓ Manual form entry
✓ Test with different paper details
✓ Check back button navigation
```

### 2. Review Analysis Results
The analysis shows:
- **Overall Score:** 0-100 (lower is better)
- **6 Detection Signals:**
  - Red (⚠️) = High risk
  - Yellow (⚠️) = Moderate concern
  - Green (✓) = Low risk
- **Detailed Findings:** Click to expand each signal
- **Recommendations:** 5 actionable steps

### 3. Use the Extension (if loaded)
1. Visit Google Scholar or arXiv
2. Click PaperTrace icon
3. Click "Analyze This Paper"
4. View results in popup
5. Click "View Full Report" for details

## Troubleshooting

### App won't start?
```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
npm run dev
```

### Port 3000 in use?
```bash
# Kill process on port 3000
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### Extension not working?
1. Open `extension/popup.js`
2. Make sure `API_ENDPOINT` is correct
3. Reload extension from chrome://extensions/
4. Open DevTools (F12) and check Console tab

## Key Files to Understand

| File | Purpose |
|------|---------|
| `app/page.tsx` | Main app UI |
| `components/PaperUpload.tsx` | Upload form |
| `components/ResultsDashboard.tsx` | Results display |
| `lib/detectionEngine.ts` | Analysis logic |
| `app/api/analyze/route.ts` | API endpoint |
| `extension/popup.js` | Extension logic |

## API Endpoint

The backend accepts POST requests:

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Paper Title",
    "authors": ["Author 1"],
    "year": 2024,
    "abstractText": "Abstract here",
    "fullText": "Full text here",
    "citations": [],
    "methodologies": [],
    "coauthorPatterns": [],
    "fieldHistory": []
  }'
```

Response:
```json
{
  "title": "Paper Title",
  "authors": ["Author 1"],
  "year": 2024,
  "overallScore": 35,
  "signals": [
    {
      "signalName": "Citation Integrity",
      "score": 25,
      "severity": "green",
      "details": [...]
    }
  ],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Environment Setup

No environment variables required! The app works out of the box with:
- In-memory caching
- No database needed
- No API keys required

To add features later, see `DEPLOYMENT.md`

## Next Steps

1. **Explore the code:**
   - Detection signals in `lib/detectionEngine.ts`
   - UI components in `components/`
   - API route in `app/api/analyze/`

2. **Deploy to production:**
   - Follow `DEPLOYMENT.md`
   - Update extension API URL
   - Submit extension to Chrome Web Store (optional)

3. **Customize:**
   - Modify detection algorithms
   - Add new signals
   - Change color theme in `app/globals.css`
   - Add user authentication

4. **Scale up:**
   - Add database (Supabase/Neon)
   - Implement persistent caching (Redis)
   - Add user accounts
   - Integrate with citation APIs

## Resource Links

- 📚 Full docs: [README.md](README.md)
- 🔌 Extension guide: [EXTENSION_GUIDE.md](EXTENSION_GUIDE.md)
- 🚀 Deploy guide: [DEPLOYMENT.md](DEPLOYMENT.md)
- 📊 Project summary: [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)

## One-Liner Commands

```bash
# Install + start
npm install && npm run dev

# Build for production
npm run build && npm start

# Format code
npm run format

# Type check
npm run typecheck
```

## Done!

You now have a fully functional paper integrity analysis system! 🎉

**Next:** Deploy to production and start analyzing papers!

Questions? Check the full documentation in README.md
