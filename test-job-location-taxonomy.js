import assert from 'node:assert/strict'
import {
  JOB_LOCATION_ADMIN_QUICK_TAGS,
  JOB_LOCATION_TAXONOMY,
  buildJobLocationAvailability,
  getJobLocationParentValue,
  matchesJobLocationFilter,
  resolveJobLocationPanelParent
} from './lib/shared/job-location-taxonomy.js'

const cases = [
  ['中国远程', 'China', true],
  ['香港远程', 'GreaterChina', true],
  ['Tokyo, Japan (Remote)', 'EastAsia', true],
  ['Singapore / Remote', 'SoutheastAsia', true],
  ['Asia Remote', 'APAC', true],
  ['Almaty, Kazakhstan (Remote)', 'CentralAsia', true],
  ['Vladivostok / Remote', 'NorthAsia', true],
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
assert.equal(matchesJobLocationFilter('Tokyo, Japan (Remote)', 'SoutheastAsia'), false, 'specific APAC subregions must remain distinct')
assert.equal(matchesJobLocationFilter('East Asia Remote', 'SoutheastAsia'), false, 'a named APAC child must not leak into sibling filters')
assert.equal(matchesJobLocationFilter('South Asia Remote', 'CentralAsia'), false, 'broad Asia wording must not override a named child region')
for (const childValue of ['EastAsia', 'SoutheastAsia', 'SouthAsia', 'CentralAsia', 'NorthAsia', 'Oceania']) {
  assert.equal(
    matchesJobLocationFilter('亚太远程', childValue),
    true,
    `broad APAC jobs should remain eligible for ${childValue}`
  )
}
assert.equal(getJobLocationParentValue('Canada'), 'EuropeAmericas')
assert.equal(getJobLocationParentValue('SoutheastAsia'), 'APAC')

assert.equal(resolveJobLocationPanelParent({
  selectedValues: ['China', 'APAC', 'Global'],
  visibleParentValues: ['China', 'APAC', 'Global'],
  toggledParentValue: 'APAC',
  willSelect: false
}), 'China', 'deselecting a parent should focus the first parent that remains selected')
assert.equal(resolveJobLocationPanelParent({
  selectedValues: ['China', 'Global'],
  visibleParentValues: ['China', 'APAC', 'Global'],
  toggledParentValue: 'APAC',
  willSelect: true
}), 'APAC', 'selecting a parent should focus that parent')

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

const broadApacAvailability = new Map(buildJobLocationAvailability(['亚太远程']).map(item => [item.value, item.count]))
for (const value of ['APAC', 'EastAsia', 'SoutheastAsia', 'SouthAsia', 'CentralAsia', 'NorthAsia', 'Oceania']) {
  assert.ok((broadApacAvailability.get(value) || 0) > 0, `broad APAC availability should include ${value}`)
}

assert.deepEqual(
  JOB_LOCATION_TAXONOMY.find(group => group.value === 'APAC')?.children.map(option => option.label),
  ['东亚', '东南亚', '南亚', '中亚', '北亚', '大洋洲']
)

assert.deepEqual(
  JOB_LOCATION_TAXONOMY.map(group => group.label),
  ['中国远程', '亚太远程', '欧美远程', '拉美远程', '中东及非洲远程', '全球远程']
)

assert.ok(JOB_LOCATION_ADMIN_QUICK_TAGS.includes('欧美远程'))
for (const removedSecondaryTag of ['东亚远程', '东南亚远程', '南亚远程', '中亚远程', '北亚远程', '大洋洲远程']) {
  assert.equal(JOB_LOCATION_ADMIN_QUICK_TAGS.includes(removedSecondaryTag), false)
}

console.log('✅ Job location taxonomy tests passed')
