import fs from 'node:fs';

const adminHandler = fs.readFileSync('api/admin/job-bundles.js', 'utf8');
const publicHandler = fs.readFileSync('lib/api-handlers/job-bundles.js', 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect(adminHandler.includes('corporate_english_materials'), 'Admin picker must include published CEO materials.');
expect(adminHandler.includes("video_id: `ceo:${video.material_id}`"), 'CEO picker IDs must be namespaced.');
expect(publicHandler.includes("const CEO_VIDEO_PREFIX = 'ceo:'"), 'Public bundle handler must recognise CEO video IDs.');
expect(publicHandler.includes('/careerlearning/watch/ceo/'), 'CEO bundle items must open the CEO watch route.');
expect(publicHandler.includes('ownerType=material'), 'CEO bundle items must resolve material cover images.');
expect(publicHandler.includes('material_title AS video_title'), 'CEO video-open events must resolve a material title.');

console.log('job bundle career video source checks passed');
