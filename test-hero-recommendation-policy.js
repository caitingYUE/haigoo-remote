import assert from 'node:assert/strict';
import {
  computeDirectionScore,
  expandDirectionTerms,
  findHeroRecommendationRunForDate,
  getRecentHeroRecommendationJobIds,
  normalizeHeroRecommendationContextKey,
  normalizeHeroRecommendationDateKey,
  selectDiversifiedHeroMatches,
} from './lib/api-handlers/copilot-v1.3.js';

function candidate(id, company = `Company ${id}`, score = 100 - Number(id)) {
  return {
    job: { id: String(id), company },
    score,
  };
}

const recentIds = Array.from({ length: 15 }, (_, index) => String(index + 1));
const ranked = Array.from({ length: 20 }, (_, index) => candidate(index + 1));
const freshFive = selectDiversifiedHeroMatches(ranked, 5, recentIds);

assert.deepEqual(
  freshFive.map(item => item.job.id),
  ['16', '17', '18', '19', '20'],
  'the next run must exclude every job from the previous three five-job runs',
);

const repeatsOnly = selectDiversifiedHeroMatches(ranked.slice(0, 15), 5, recentIds);
assert.equal(repeatsOnly.length, 0, 'recent jobs must never be reintroduced as a fallback');

const oneCompanyPool = Array.from({ length: 7 }, (_, index) => candidate(index + 30, 'One Company'));
const oneCompanyResult = selectDiversifiedHeroMatches(oneCompanyPool, 5, []);
assert.equal(oneCompanyResult.length, 5, 'company diversity may relax when needed to fill five slots');
assert.equal(new Set(oneCompanyResult.map(item => item.job.id)).size, 5, 'one run must not contain duplicate jobs');

assert.equal(normalizeHeroRecommendationDateKey('2026-07-15'), '2026-07-15');
assert.equal(
  normalizeHeroRecommendationContextKey(' Product Manager :: FULL-TIME :: Resume:ABC '),
  'product manager :: full-time :: resume:abc',
);

const productTerms = expandDirectionTerms('全栈产品经理');
const productScore = computeDirectionScore(productTerms, '全栈产品经理', {
  title: 'Senior Product Manager',
  category: '产品经理',
  description: 'Lead a SaaS product roadmap with engineering and design.',
});
const unrelatedScore = computeDirectionScore(productTerms, '全栈产品经理', {
  title: 'Senior Clinical Data Manager',
  category: '临床数据',
  description: 'Manage clinical trial datasets and regulatory submissions.',
});
assert.ok(productScore > unrelatedScore * 3, 'career direction must dominate unrelated fresh jobs');

const storedRuns = [
  { context_key: 'pm::full-time::profile', recommendation_date: '2026-07-15', job_ids: ['a', 'b', 'c', 'd', 'e'] },
  { context_key: 'pm::full-time::profile', recommendation_date: '2026-07-14', job_ids: ['f', 'g', 'h', 'i', 'j'] },
  { context_key: 'pm::full-time::profile', recommendation_date: '2026-07-13', job_ids: ['k', 'l', 'm', 'n', 'o'] },
  { context_key: 'pm::full-time::profile', recommendation_date: '2026-07-12', job_ids: ['p', 'q', 'r', 's', 't'] },
];
assert.equal(
  findHeroRecommendationRunForDate(storedRuns, 'pm::full-time::profile', '2026-07-15'),
  storedRuns[0],
  'same-day visits must resolve to the persisted daily snapshot',
);
assert.deepEqual(
  getRecentHeroRecommendationJobIds(storedRuns, 3),
  ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o'],
  'deduplication must use exactly the latest three recommendation runs',
);

console.log('Hero recommendation policy tests passed.');
