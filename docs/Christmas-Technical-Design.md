# Christmas Campaign - Technical Design & Implementation

## 1. System Architecture

The Christmas Campaign ("Resume Christmas Tree") is built on the Haigoo Remote platform using a hybrid rendering approach.

### Core Stack
- **Frontend**: React (Vite), Tailwind CSS, Framer Motion (animations), html2canvas (image gen)
- **Backend**: Node.js Serverless Functions (Vercel)
- **Database**: Neon (PostgreSQL)
- **AI**: Alibaba Bailian / DeepSeek (via `christmas-service.js`)
- **Storage**: Database for JSON/Text; local/temp for file processing

---

## 2. Feature Implementation Details

### 2.1 Tree Generation (Phase 1)
- **Resume Parsing**: Hybrid approach. 
  - Python script (`api/pdf_parser.py`) for PDF complex layout.
  - Node.js (`pdf-parse`, `mammoth`) fallback.
- **AI Analysis**: 
  - Prompt: `CHRISTMAS_PROMPT` in `api/campaign/christmas.js`.
  - Output: JSON with `tree_structure` (layers, keywords) and `interpretation`.
- **Rendering**: 
  - `TreeRenderer.tsx`: SVG-based component.
  - **Algorithm**: Weighted keyword distribution into 6 structured cone layers.
  - **Themes**: Engineering (Circuit), Creative (Watercolor), Growth (Gradient).

### 2.2 Download & Share (Phase 1)
- **Image Generation**: client-side `html2canvas` @ 2x scale.
- **Lead Capture**: 
  - `EmailCaptureModal` intercepts download.
  - API `POST /api/campaign/christmas?action=lead`.
  - Storage: `campaign_leads` table.
- **Sharing**: Native Web Share API (`navigator.share`) for mobile/supported browsers.

### 2.3 Happiness Card System (Phase 2 - Current)
- **Concept**: Users draw 1 healing card per day.
- **Storage**: `localStorage` key `haigoo_xmas_card_drawn_{date}`.
- **Encryption**: None (client-side enforcement sufficient for this fun feature).
- **Asset**: Card library in `src/data/happiness-cards.json`.

### 2.4 Public Forest (Phase 2 - Planned)
- **Goal**: Gallery of user-generated trees.
- **Database Schema**:
  ```sql
  CREATE TABLE campaign_forest (
      id SERIAL PRIMARY KEY,
      tree_id VARCHAR(255) UNIQUE NOT NULL,
      tree_data JSONB NOT NULL, -- Snapshot of visual data
      star_label VARCHAR(100),
      user_nickname VARCHAR(100) DEFAULT 'Anonymous',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      likes INTEGER DEFAULT 0
  );
  ```
- **API**: `GET /api/campaign/forest` (paginated).

---

## 3. API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/campaign/christmas` | POST | Upload resume, generate tree |
| `/api/campaign/christmas?action=lead` | POST | Save email lead |
| `/api/proxy?type=image` | GET/POST | Proxy images (bypass CORS) |
| `/api/proxy?type=rss` | GET | Proxy RSS feeds |
| `/api/campaign/forest` | GET | (Planned) Fetch forest trees |

---

## 4. Frontend Component Structure

- `ChristmasPage` (Main Container)
  - `TreeRenderer` (The visual tree)
  - `EmailCaptureModal`
  - `HappinessCard` (New)
  - `ForestGrid` (New)

---

## 5. Deployment Considerations
- **Serverless Limits**: Vercel Hobby plan limit (12 functions).
- **Optimization**: All proxy logic consolidated in `api/proxy.js`. Campaign logic consolidated in `api/campaign/christmas.js`.

