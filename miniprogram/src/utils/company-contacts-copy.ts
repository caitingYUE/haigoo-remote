import type { MemberOnlyContact } from '../types'

export function buildCompanyContactsCopy(companyName: string, contacts: MemberOnlyContact[]) {
  const clean = (value?: string) => String(value || '').replace(/\s+/g, ' ').trim()
  return [clean(companyName), ...contacts.map((contact, index) =>
    `联系人${contacts.length > 1 ? index + 1 : ''}: ${[contact.name, contact.title, contact.email, contact.linkedin].map(clean).join('｜')}`
  )].join('\n')
}
