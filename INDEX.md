# PaperTrace - Complete Index

Welcome to PaperTrace! This document guides you through the project structure and documentation.

## Quick Navigation

### 🚀 Getting Started
- **[QUICKSTART.md](QUICKSTART.md)** - Start here! (5-minute setup)
- **[README.md](README.md)** - Complete project overview

### 📖 Documentation
- **[EXTENSION_GUIDE.md](EXTENSION_GUIDE.md)** - Browser extension setup and usage
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment guide
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Detailed project breakdown

## Project Structure at a Glance

```
papertrace/
├── 📱 Web App (Next.js + React)
│   ├── app/page.tsx               ← Main app
│   ├── app/api/analyze/route.ts   ← Analysis API
│   ├── components/
│   │   ├── PaperUpload.tsx        ← Upload UI
│   │   └── ResultsDashboard.tsx   ← Results UI
│   └── lib/detectionEngine.ts     ← 6 Detection Signals
│
├── 🔌 Browser Extension (Chrome)
│   ├── manifest.json              ← Config
│   ├── popup.html/js              ← Quick results
│   ├── content.js                 ← Metadata extraction
│   ├── background.js              ← Service worker
│   └── options.html/js            ← Settings
│
├── 📚 Documentation
│   ├── README.md                  ← Full docs
│   ├── QUICKSTART.md              ← 5-min setup
│   ├── EXTENSION_GUIDE.md         ← Extension help
│   ├── DEPLOYMENT.md              ← Deploy guide
│   ├── PROJECT_SUMMARY.md         ← Technical details
│   └── INDEX.md                   ← This file
│
└── 📦 Configuration
    ├── package.json               ← Dependencies
    ├── tsconfig.json              ← TypeScript config
    ├── next.config.mjs            ← Next.js config
    └── tailwind.config.ts         ← Tailwind config
```

## The 6 Detection Signals

PaperTrace analyzes papers with 6 sophisticated signals:

| Signal | What It Does | Score Impact |
|--------|-------------|--------------|
| **Citation Integrity** | Verifies citations match source abstracts | 0-100 |
| **Temporal Impossibility** | Detects future-dated or anachronistic references | 0-100 |
| **Internal Consistency** | Checks claim repetition and contradictions | 0-60 |
| **Methodology Novelty** | Validates novel method claims | 0-80 |
| **Author Footprint** | Analyzes collaboration patterns | 0-50 |
| **Semantic Anomalies** | Detects contradictory language | 0-100 |

**Overall Score = Average of all signals (0-100)**
- Green (< 30): Paper appears reliable
- Yellow (30-60): Moderate concerns
- Red (> 60): High risk of integrity issues

## File Guide

### Web App Core

**`app/page.tsx`** - Main application
- Manages upload/results state
- Calls API endpoint
- Renders PaperUpload or ResultsDashboard

**`components/PaperUpload.tsx`** - Upload interface
- Drag-drop or manual input
- Form validation
- File handling

**`components/ResultsDashboard.tsx`** - Results display
- Overall score card
- 6 signal cards (color-coded)
- Detailed findings
- Actionable recommendations

**`lib/detectionEngine.ts`** - Analysis engine
- 6 detection signal functions
- In-memory cache system
- Report generation
- Main `analyzePaper()` orchestrator

**`app/api/analyze/route.ts`** - Backend API
- POST endpoint
- Calls detection engine
- Error handling
- Response formatting

### Browser Extension

**`extension/manifest.json`** - Extension config
- Permissions
- Host patterns
- Script locations

**`extension/popup.html`** - Quick results popup
- Analysis button
- Status display
- Results summary
- Settings link

**`extension/popup.js`** - Popup logic
- API communication
- Results display
- Report generation

**`extension/content.js`** - Site extraction
- Google Scholar parsing
- arXiv parsing
- DOI parsing
- ResearchGate parsing
- Semantic Scholar parsing
- Fallback generic extraction

**`extension/background.js`** - Service worker
- Extension lifecycle
- Tab monitoring
- Script injection

**`extension/options.html/js`** - Settings page
- API endpoint configuration
- Auto-analyze toggle
- Settings management

### Styling

**`app/globals.css`** - Theme and styles
- Color design tokens
- Dark mode theme
- Tailwind imports
- Global styles

Color Palette:
- **Primary:** #3b82f6 (Blue)
- **Success:** #10b981 (Green)
- **Warning:** #f59e0b (Amber)
- **Danger:** #ef4444 (Red)
- **Background:** #0f172a (Very Dark Blue)
- **Surface:** #1e293b (Dark Blue)
- **Text:** #e2e8f0 (Light Gray)

## How to Use Each Part

### Using the Web App
1. Visit the app
2. Upload or enter paper details
3. Click "Analyze Paper"
4. Review results and recommendations
5. Click "Back" to analyze another paper

### Using the Extension
1. Navigate to supported paper site
2. Click PaperTrace icon
3. Click "Analyze This Paper"
4. View quick results in popup
5. Click "View Full Report" for full analysis
6. Click "Settings" to configure

### Extending the System
1. Add new detection signals in `lib/detectionEngine.ts`
2. Create new API routes in `app/api/`
3. Add UI components in `components/`
4. Update documentation
5. Test and deploy

## Environment & Configuration

**No environment variables required!**

The app works with default configuration:
- Uses in-memory caching
- No database needed
- No API keys required

Optional upgrades (see DEPLOYMENT.md):
- Redis for distributed caching
- PostgreSQL/Supabase for persistence
- Sentry for error tracking
- Analytics tools

## Development Workflow

```bash
# Start
npm install
npm run dev

# Build
npm run build

# Check types
npm run typecheck

# Deploy
vercel
```

## API Reference

**Endpoint:** `POST /api/analyze`

**Input:**
```json
{
  "title": "string",
  "authors": ["string"],
  "year": number,
  "abstractText": "string",
  "fullText": "string",
  "citations": [{ "text": "string", "abstract": "string", "year": number }],
  "methodologies": ["string"],
  "coauthorPatterns": [{ "coauthor": "string", "frequency": number }],
  "fieldHistory": [{ "method": "string", "year": number }]
}
```

**Output:**
```json
{
  "title": "string",
  "authors": ["string"],
  "year": number,
  "overallScore": number (0-100),
  "signals": [
    {
      "signalName": "string",
      "score": number (0-100),
      "severity": "green" | "yellow" | "red",
      "details": ["string"]
    }
  ],
  "timestamp": "ISO8601"
}
```

## Decision Points for Customization

### Want to change colors?
→ Edit `app/globals.css` - color tokens

### Want to add a detection signal?
→ Add function in `lib/detectionEngine.ts` and call from `analyzePaper()`

### Want to add persistent storage?
→ See `DEPLOYMENT.md` - Database section

### Want to deploy?
→ See `DEPLOYMENT.md` - Multiple deployment options

### Want to extend the extension?
→ See `EXTENSION_GUIDE.md` - Extension development

### Want to improve detection accuracy?
→ Enhance algorithms in `lib/detectionEngine.ts`

## Common Tasks

| Task | File | Action |
|------|------|--------|
| Change color theme | `app/globals.css` | Update CSS variables |
| Add detection signal | `lib/detectionEngine.ts` | Add function, call from `analyzePaper()` |
| Fix UI styling | `components/*.tsx` | Update Tailwind classes |
| Change API behavior | `app/api/analyze/route.ts` | Modify endpoint logic |
| Update extension sites | `extension/content.js` | Add extraction function |
| Deploy to production | `DEPLOYMENT.md` | Follow deployment guide |
| Add error tracking | `DEPLOYMENT.md` | Integrate Sentry |
| Add database | `DEPLOYMENT.md` | Setup Supabase/Neon |

## Performance Tips

- **In-memory cache** automatically caches analyses for 1 hour
- **API response** typically < 500ms
- **Extension popup** updates instantly from cache
- Upgrade to **Redis** for distributed systems
- Add **database** for persistent storage

## Security Considerations

- No external data transmission
- All processing local or on your server
- Extension has minimal permissions
- No user tracking
- No analytics by default
- Upgrade for auth if needed

## Troubleshooting

### Build fails?
```bash
rm -rf node_modules .next
npm install
npm run build
```

### Extension not working?
- Check API URL in extension settings
- Open DevTools (F12) to see errors
- Reload extension from chrome://extensions/

### App runs slow?
- Check in-memory cache is working
- Monitor API response times
- Consider upgrading to Redis cache

## Learning Resources

- **Next.js:** https://nextjs.org/docs
- **React:** https://react.dev
- **TypeScript:** https://typescriptlang.org
- **Tailwind:** https://tailwindcss.com
- **Chrome Extensions:** https://developer.chrome.com/docs/extensions/

## What's Next?

1. **Run locally:** Follow [QUICKSTART.md](QUICKSTART.md)
2. **Deploy:** Use [DEPLOYMENT.md](DEPLOYMENT.md)
3. **Customize:** Modify detection signals or UI
4. **Extend:** Add features from "Planned Improvements" in README
5. **Distribute:** Submit extension to Chrome Web Store

## Support & Help

- 📖 **Documentation:** Read README.md
- 🚀 **Quick start:** Follow QUICKSTART.md
- 🔌 **Extension help:** Check EXTENSION_GUIDE.md
- 📦 **Deployment:** See DEPLOYMENT.md
- 💡 **Architecture:** Review PROJECT_SUMMARY.md

## Project Stats

- **Languages:** TypeScript, JavaScript
- **Framework:** Next.js 16 + React 19
- **Lines of Code:** ~2000 (excluding comments)
- **Detection Signals:** 6
- **Components:** 5+ UI components
- **API Endpoints:** 1 (extensible)
- **Extension Scripts:** 4

---

**You're all set!** Start with [QUICKSTART.md](QUICKSTART.md) to get running in 5 minutes.

Happy analyzing! 📚🔍
