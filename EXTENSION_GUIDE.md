# PaperTrace Browser Extension Guide

PaperTrace provides a powerful browser extension that integrates with academic research platforms to analyze papers for integrity issues in real-time.

## Installation

### For Development

1. **Build the web app first:**
   ```bash
   npm install
   npm run dev
   ```
   The app will be available at `http://localhost:3000`

2. **Load the extension in Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `/extension` folder from this project
   - The extension icon should appear in your toolbar

3. **Configure the extension:**
   - Click the PaperTrace icon in your toolbar
   - Click "Settings"
   - Ensure API URL is set to `http://localhost:3000/api/analyze`
   - Save settings

### For Production

1. Deploy the web app to Vercel or your hosting service
2. Update the API endpoint in the extension:
   - Edit `extension/popup.js` and `extension/background.js`
   - Change `http://localhost:3000` to your production URL
   - Update `extension/options.html` default text
3. Package the extension:
   - Zip the `/extension` folder
   - Submit to Chrome Web Store (requires developer account)

## Supported Websites

PaperTrace works on:
- Google Scholar (scholar.google.com)
- arXiv (arxiv.org)
- DOI (doi.org)
- ResearchGate (researchgate.net)
- Semantic Scholar (semanticscholar.org)

The extension automatically detects papers and extracts metadata from these sites.

## Features

### Quick Analysis
1. Navigate to any supported academic paper
2. Click the PaperTrace icon in your toolbar
3. Click "Analyze This Paper"
4. View integrity scores and detection signals instantly

### Detection Signals

The extension checks 6 integrity signals:

1. **Citation Integrity** - Verifies citations match source abstracts
2. **Temporal Impossibility** - Detects citations from future dates
3. **Internal Consistency** - Checks claim repetition patterns
4. **Methodology Novelty** - Validates methodology claims
5. **Author Footprint** - Analyzes collaboration patterns
6. **Semantic Anomalies** - Detects contradictory statements

### Settings
- **API Endpoint** - Configure custom backend URL
- **Auto-Analyze** - Automatically analyze papers (coming soon)

## Architecture

```
extension/
├── manifest.json      - Extension configuration
├── popup.html         - Quick results popup
├── popup.js          - Popup logic
├── content.js        - Page content extraction
├── background.js     - Service worker
├── options.html      - Settings page
└── options.js        - Settings logic
```

### Data Flow

1. **Content Script** (`content.js`) extracts paper metadata from the page
2. **Popup** (`popup.js`) sends data to backend API
3. **Backend** (`/api/analyze`) runs all 6 detection signals
4. **Results** displayed in popup and full report

## Development

### Debugging

1. **Extension errors:**
   - Open `chrome://extensions/`
   - Find PaperTrace and click "Details"
   - Click "Errors" to see any issues

2. **Popup errors:**
   - Right-click extension icon → Inspect popup
   - Check Console tab for errors

3. **Content script errors:**
   - Open DevTools on any supported page
   - Check Console for "[PaperTrace]" messages

### Testing on Different Sites

**Google Scholar:**
```
1. Go to scholar.google.com
2. Search for any paper
3. Click the PaperTrace icon
4. Click "Analyze This Paper"
```

**arXiv:**
```
1. Go to arxiv.org/list/cs.AI/recent
2. Click on any paper
3. Click the PaperTrace icon
4. Results display in popup
```

## API Integration

The extension communicates with the backend via POST requests:

```javascript
POST /api/analyze
Content-Type: application/json

{
  "title": "Paper Title",
  "authors": ["Author 1", "Author 2"],
  "year": 2024,
  "abstractText": "...",
  "fullText": "...",
  "citations": [...],
  "methodologies": [...],
  "coauthorPatterns": [...],
  "fieldHistory": [...]
}
```

Response:
```json
{
  "title": "Paper Title",
  "authors": ["Author 1", "Author 2"],
  "year": 2024,
  "overallScore": 45,
  "signals": [
    {
      "signalName": "Citation Integrity",
      "score": 25,
      "severity": "green",
      "details": [...]
    },
    ...
  ],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Troubleshooting

### Extension not appearing
- Reload the extension from `chrome://extensions/`
- Clear extension storage: right-click icon → "Manage extension" → "Storage"

### "Analysis failed" error
- Check that the web app is running (`npm run dev`)
- Verify API URL in settings matches your app URL
- Check browser console for detailed error messages

### Data not extracting properly
- Some sites may require custom parsing logic
- Edit `extension/content.js` to improve extraction for specific sites

### CORS errors
- If deployed, ensure backend accepts requests from extension origin
- Add CORS headers to your API response

## Permissions

The extension requests these permissions:
- `scripting` - To inject content scripts
- `activeTab` - To analyze current tab
- `storage` - To save settings and reports
- Host permissions for supported academic sites

All data processing happens locally in the extension or backend. No data is sent to third parties.

## Future Improvements

- Auto-analysis on page load (with user consent)
- History of analyzed papers
- Export reports as PDF
- Cite detection and cross-verification
- Author profile analysis
- Integration with paper libraries

## Support

For issues or feature requests, please refer to the main PaperTrace README.md
