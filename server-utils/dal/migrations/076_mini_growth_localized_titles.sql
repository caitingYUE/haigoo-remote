ALTER TABLE corporate_english_module_videos
  ADD COLUMN IF NOT EXISTS title_zh TEXT NOT NULL DEFAULT '';

-- Existing structured notes already contain editorial Chinese headings. Use
-- the first one as the initial mobile title; editors can refine it later.
WITH headings AS (
  SELECT video.video_id,
         (
           SELECT NULLIF(BTRIM(block->>'text'), '')
             FROM jsonb_array_elements(video.video_notes) AS block
            WHERE block->>'type' IN ('heading_1', 'heading_2')
              AND NULLIF(BTRIM(block->>'text'), '') IS NOT NULL
            LIMIT 1
         ) AS title
    FROM corporate_english_module_videos AS video
   WHERE video.module_key = 'remote_preparation'
     AND video.title_zh = ''
)
UPDATE corporate_english_module_videos AS video
   SET title_zh = headings.title
  FROM headings
 WHERE video.video_id = headings.video_id
   AND headings.title IS NOT NULL;
