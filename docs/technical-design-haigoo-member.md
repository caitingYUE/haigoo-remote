# Haigoo Member Technical Implementation Plan

## 1. Overview
Merge existing membership tiers (`club_go`, `goo_plus`) into a single **"Haigoo Member"** tier. Implement value-added features: Trust Filtering, Decision Support (Risk Ratings, Comments), and Application Execution (Tracking, Referrals).

## 2. Database Schema Changes (Postgres/Neon)

### 2.1 Users Table
Consolidate membership status.
```sql
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS member_status VARCHAR(20) DEFAULT 'free', -- 'free', 'active', 'expired'
ADD COLUMN IF NOT EXISTS member_expire_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS member_since TIMESTAMP WITH TIME ZONE;
```

### 2.2 Jobs Table
Add value-added metadata.
```sql
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS risk_rating JSONB, -- { friendly_score: 1-5, reply_rate: 'low'|'mid'|'high', risk_tags: [] }
ADD COLUMN IF NOT EXISTS haigoo_comment TEXT, -- Manual editorial comment
ADD COLUMN IF NOT EXISTS hidden_fields JSONB; -- { english_req: '...', timezone: '...' }
```

### 2.3 User Job Interactions Table
Track the full lifecycle of a user's interaction with a job.
```sql
CREATE TABLE IF NOT EXISTS user_job_interactions (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  interaction_type VARCHAR(20) NOT NULL, -- 'bookmark', 'apply_redirect', 'apply_internal'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'replied', 'interview', 'offer', 'rejected'
  resume_id TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, job_id, interaction_type)
);
```

## 3. Backend Implementation (Phase 1)

### 3.1 User Model
- Update `lib/server-utils/user-helper.js` to read/write new membership fields.
- Update `api/auth.js` to return these fields in the session.

### 3.2 Job Model
- Update job fetching logic to include `risk_rating` and `haigoo_comment`.
- *Note*: Data masking for free users will be implemented in Phase 2.

### 3.3 Admin Operations
- Update `api/admin-ops.js` to support database migration.
- Add endpoints to manage user membership manually.

## 4. Frontend Implementation (Phase 1 & 2)

### 4.1 Types
- Update `src/types/auth-types.ts` to include `memberStatus`, `memberExpireAt`.

### 4.2 Job Detail Page
- Redesign to show Risk Ratings and Comments.
- Implement "Blur" effect for non-members.

### 4.3 Interaction
- Add "Apply" interception logic (Modal for Free vs Direct for Member).

## 5. Execution Roadmap

### Phase 1: Foundation (Current)
- [x] Design Doc
- [ ] Database Schema Migration
- [ ] Backend User/Job Model Updates
- [ ] Admin Panel - User Membership Management

### Phase 2: Value Perception (Frontend)
- [ ] Job Detail Page Redesign (Risk/Comments)
- [ ] Non-member masking

### Phase 3: Execution Loop
- [ ] Application Tracking
- [ ] Referral Flow
