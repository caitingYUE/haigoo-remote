import assert from 'node:assert/strict'
import {
  JOB_LOCATION_TAXONOMY,
  buildJobLocationAvailability,
  getJobLocationParentValue,
  matchesJobLocationFilter
} from './lib/shared/job-location-taxonomy.js'

const cases = [
  ['中国远程', 'China', true],
  ['香港远程', 'GreaterChina', true],
  ['Tokyo, Japan (Remote)', 'EastAsia', true],
  ['Singapore / Remote', 'SoutheastAsia', true],
  ['Asia Remote', 'APAC', true],
  ['Australia Remote', 'Oceania', true],
  ['US Remote', 'EuropeAmericas', true],
  ['Canada Remote', 'Canada', true],
  ['London, UK (Remote)', 'UnitedKingdomIreland', true],
  ['Berlin, Germany (Remote)', 'WesternEurope', true],
  ['Warsaw, Poland (Remote)', 'CentralEasternEurope', true],
  ['Mexico City / Remote', 'LatinAmerica', true],
  ['São Paulo, Brazil (Remote)', 'SouthAmerica', true],
  ['Dubai, UAE (Remote)', 'MiddleEast', true],
  ['Cape Town, South Africa (Remote)', 'Africa', true],
  ['EMEA Remote', 'MiddleEastAfrica', true],
  ['Worldwide', 'Global', true],
  ['Remote', 'GlobalUnrestricted', true]
]

for (const [location, filterValue, expected] of cases) {
  assert.equal(
    matchesJobLocationFilter(location, filterValue),
    expected,
    `${location} should match ${filterValue}`
  )
}

assert.equal(matchesJobLocationFilter('US Remote', 'Global'), false, 'US-only jobs must not be treated as global')
assert.equal(matchesJobLocationFilter('Singapore / Remote', 'EuropeAmericas'), false, 'APAC jobs must not match Europe/Americas')
assert.equal(getJobLocationParentValue('Canada'), 'EuropeAmericas')
assert.equal(getJobLocationParentValue('SoutheastAsia'), 'APAC')

const availability = new Map(buildJobLocationAvailability([
  '中国远程',
  'US Remote',
  'Worldwide'
]).map(item => [item.value, item.count]))

assert.ok((availability.get('China') || 0) > 0)
assert.ok((availability.get('EuropeAmericas') || 0) > 0)
assert.ok((availability.get('Global') || 0) > 0)
assert.equal(availability.has('APAC'), false)
assert.equal(availability.has('LatinAmerica'), false)

assert.deepEqual(
  JOB_LOCATION_TAXONOMY.map(group => group.label),
  ['中国远程', '亚太远程', '欧美远程', '拉美远程', '中东及非洲远程', '全球远程']
)

console.log('✅ Job location taxonomy tests passed')
