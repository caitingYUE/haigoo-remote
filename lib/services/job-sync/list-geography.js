// Geography from listing metadata only; never infer eligibility from language.
const regions = new Intl.DisplayNames(['en'], {type:'region',fallback:'none'})
export function countryName(code) {
  const alpha3={CHN:'CN',USA:'US',GBR:'GB',IND:'IN',MEX:'MX',NLD:'NL',CYP:'CY',CAN:'CA',AUS:'AU',BRA:'BR',IRL:'IE',ZAF:'ZA',JPN:'JP',DEU:'DE',FRA:'FR',SGP:'SG',PHL:'PH',POL:'PL',TWN:'TW',HKG:'HK'}
  const raw=String(code||'').trim()
  const value=alpha3[raw.toUpperCase()]||raw.toUpperCase()
  if(!/^[A-Z]{2}$/.test(value||'')) return ''
  return regions.of(value)||''
}
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const countryNames=[]
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++) {
  const code=String.fromCharCode(a,b),name=countryName(code)
  if(name&&!['CN','TW','HK','MO','ZZ'].includes(code))countryNames.push(escape(name))
}
const outside=new RegExp(`\\b(?:${countryNames.join('|')}|USA?|UK|EU|EMEA|LATAM|CIS|Americas|Africa|East Africa|Myanmar(?:\\s*\\(Burma\\))?|Europe|North America|South America|England|Scotland|Wales|Northern Ireland|Russia|South Korea|Vietnam|Turkey|Florida|California|Wisconsin|Idaho|Ontario|Washington|San Francisco|New York|Denver|Dallas|Los Angeles|Las Vegas|London|Dublin|Paris|Berlin|Bangalore|Bengaluru|Tokyo|Seoul|Montreal|Kuala Lumpur|Baku|Almaty|Lisbon|Barcelona|Istanbul|Iberia|Perm|Krakow|Bucharest|British Columbia|Peterborough|Flixborough|Walsingham|Cupar|Devon|Rugeley|Ottawa|Perth|Boise|Clearwater|Tampa|Seattle)\\b`,'i')
const target=/\b(worldwide|anywhere|global|APAC|Asia[ -]Pacific|China|Hong Kong|Taiwan|Macao|Macau|Beijing|Shanghai|Shenzhen|Guangzhou|Taipei|CN|CHN|TW|TWN|HK|HKG|MO)\b|全球|亚太|中国|香港|台湾|澳门|北京|上海|深圳|广州|不限地区/i
export function listingGeography(location='') {
  if(target.test(location)||/^(?:Remote[ -]*)?(CN|CHN|TW|TWN|HK|HKG|MO)$/.test(location.trim()))return 'target'
  const parts=location.split(/\s*(?:;|\/|\bor\b)\s*/i).filter(Boolean)
  const canIgnoreRemote=/[;/]/.test(location)
  const geographicParts=parts.filter(part=>!canIgnoreRemote||!/^fully?\s+remote$|^remote$/i.test(part.trim()))
  if(!geographicParts.length)return 'unknown'
  return geographicParts.every(part=>{
    if(/\b(other|multiple|various|flexible|unspecified)\b/i.test(part))return false
    if(outside.test(part))return true
    const embeddedCode=part.match(/\b([A-Za-z]{2,3})\b/g)?.map(code=>code.toUpperCase()).find(code=>countryName(code))
    if(embeddedCode&&!['CN','CHN','TW','TWN','HK','HKG','MO'].includes(embeddedCode))return true
    if(['CN','CHN','TW','TWN','HK','HKG','MO'].includes(embeddedCode))return false
    // Explicit country codes, or a city followed by a US state abbreviation.
    const tail=part.match(/(?:^|[, (])([A-Za-z]{2,3})\)?\s*$/)?.[1]
    const normalized=tail?.toUpperCase()
    return !!normalized && (!!countryName(normalized)&&!['CN','CHN','TW','TWN','HK','HKG','MO'].includes(normalized) || /^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)$/.test(normalized)&&part.includes(','))
  })?'outside':'unknown'
}
