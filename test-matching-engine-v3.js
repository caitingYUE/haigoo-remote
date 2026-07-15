import assert from 'node:assert/strict';

import {
  buildMatchingProfile,
  scoreJobForUserProfile
} from './lib/services/matching-engine.js';
import { calibrateDisplayScore } from './lib/services/match-score-calibration.js';
import { buildMatchInsights } from './lib/services/match-insight-builder.js';
import { extractStructuredResume } from './lib/services/resume-structure-extractor.js';

function displayed(result) {
  return calibrateDisplayScore({
    trueScore: result.trueScore,
    constraintFlags: result.constraintFlags,
    evidenceCoverage: result.breakdown.evidenceCoverage
  });
}

function run() {
  const structured = extractStructuredResume(`
    Target Role: Senior Product Manager
    Work Experience
    2019.03 - Present  Product Manager
    Owned product strategy, roadmap, user research and A/B testing.
    Skills: Product management, SQL, Figma, data analysis.
  `, { currentDate: new Date('2026-07-15T00:00:00Z') });

  assert.equal(structured.targetRole, 'Senior Product Manager');
  assert.ok(structured.roles.includes('Product Manager'));
  assert.ok(structured.skills.includes('product_management'));
  assert.ok(structured.skills.includes('sql'));
  assert.ok(structured.experienceYears >= 7);
  assert.ok(structured.evidence_coverage >= 0.55);

  const profile = buildMatchingProfile({
    targetRole: structured.targetRole,
    roles: structured.roles,
    roleFamilies: structured.roleFamilies,
    skills: structured.skills,
    experienceYears: structured.experienceYears,
    industries: ['saas'],
    resumeText: 'Product strategy roadmap user research SQL experimentation SaaS',
    preferences: { jobTypes: ['full-time'] },
    eligibleLocations: ['China'],
    evidenceCoverage: structured.evidence_coverage
  });

  const exact = scoreJobForUserProfile(profile, {
    job_id: 'exact',
    title: 'Senior Product Manager',
    category: 'Product Manager',
    industry: 'SaaS',
    description: 'Own product strategy, roadmap, user research, SQL analytics and experiments.',
    requirements: ['5+ years experience', 'Product management', 'SQL', 'User research'],
    tags: ['roadmap', 'A/B testing'],
    experience_level: 'senior',
    job_type: 'full-time',
    location: 'Worldwide'
  });

  const weakSameFamily = scoreJobForUserProfile(profile, {
    job_id: 'weak',
    title: 'Game Product Manager',
    category: 'Product Manager',
    industry: 'Gaming',
    description: 'Own mobile game economy, monetization and live operations.',
    tags: ['game economy', 'live ops', 'monetization'],
    experience_level: 'senior',
    job_type: 'full-time',
    location: 'Worldwide'
  });

  const sparse = scoreJobForUserProfile(profile, {
    job_id: 'sparse',
    title: 'Product Manager',
    location: 'Remote'
  });

  const regionalMismatch = scoreJobForUserProfile(profile, {
    job_id: 'regional',
    title: 'Senior Product Manager',
    category: 'Product Manager',
    industry: 'SaaS',
    description: 'Own product strategy and roadmap.',
    requirements: ['Product management'],
    tags: ['roadmap'],
    experience_level: 'senior',
    job_type: 'full-time',
    location: 'Remote - United States'
  });

  const exactDisplay = displayed(exact);
  const weakDisplay = displayed(weakSameFamily);
  const sparseDisplay = displayed(sparse);
  const regionalDisplay = displayed(regionalMismatch);

  assert.ok(exact.trueScore >= 85);
  assert.ok(exact.trueScore > weakSameFamily.trueScore);
  assert.ok(exactDisplay.displayScore >= 90);
  assert.ok(weakDisplay.displayScore >= 75 && weakDisplay.displayScore <= 80);
  assert.equal(sparseDisplay.visible, false);
  assert.equal(sparseDisplay.displayScore, 0);
  const sparseInsights = buildMatchInsights({ score: sparse.trueScore, details: sparse.breakdown });
  assert.equal(sparseInsights.breakdown.skillMatch, null);
  assert.equal(sparseInsights.confidence.label, '有限');
  assert.equal(regionalMismatch.constraintFlags.remoteRegionMismatch, true);
  assert.equal(regionalDisplay.visible, false);

  console.log('matching engine v3 checks passed');
}

run();
