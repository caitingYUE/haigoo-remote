export type MembershipCodeStatus = 'unused' | 'used' | 'expired' | 'voided'
export type RedemptionMemberType = 'starter' | 'half_year' | 'annual'

export interface MembershipCodeRow {
  id: string
  code: string
  isMasked: boolean
  last4: string
  memberType: RedemptionMemberType
  durationMonths: number
  usageLimit: number
  useCount: number
  generatedAt: string
  expiresAt: string
  status: MembershipCodeStatus
  batchId: string
  batchName: string
  channel: string
  redeemedAt?: string | null
  redeemedByUserId?: string | null
  redeemedByEmail?: string | null
  redeemedByName?: string | null
  voidedAt?: string | null
  voidReason?: string | null
}

export interface MembershipCodeBatch {
  batch_id: string
  batch_key: string
  name: string
  channel: string
  member_type: RedemptionMemberType
  duration_months: number
  code_count: number
  created_by: string
  created_at: string
}

export interface MembershipCodesResponse {
  success: boolean
  isSuperAdmin: boolean
  decryptionErrorCount?: number
  codes: MembershipCodeRow[]
  summary: Record<'total' | 'unused' | 'used' | 'expired' | 'voided' | RedemptionMemberType, number>
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
  batches: MembershipCodeBatch[]
  channels: string[]
}

function authHeaders(json = false) {
  const token = localStorage.getItem('haigoo_auth_token')
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token || ''}`
  }
}

async function readError(response: Response) {
  const data = await response.json().catch(() => ({}))
  return data?.error || '兑换码操作失败'
}

export const membershipRedemptionCodeService = {
  async list(filters: Record<string, string | number | undefined>): Promise<MembershipCodesResponse> {
    const params = new URLSearchParams({ action: 'membership-codes' })
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value))
    })
    const response = await fetch(`/api/admin-ops?${params.toString()}`, { headers: authHeaders() })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(data?.error || '兑换码操作失败') as Error & { data?: Record<string, unknown> }
      error.data = data
      throw error
    }
    return data
  },

  async createBatch(input: { name: string; channel: string; memberType: RedemptionMemberType; quantity: number }) {
    const response = await fetch('/api/admin-ops?action=membership-codes', {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify(input)
    })
    if (!response.ok) throw new Error(await readError(response))
    return response.json() as Promise<{ success: true; batch: any; codes: string[] }>
  },

  async voidCode(codeId: string, reason: string) {
    const response = await fetch('/api/admin-ops?action=membership-codes', {
      method: 'PATCH',
      headers: authHeaders(true),
      body: JSON.stringify({ operation: 'void', codeId, reason })
    })
    if (!response.ok) throw new Error(await readError(response))
  },

  async updateBatch(batchId: string, name: string, channel: string) {
    const response = await fetch('/api/admin-ops?action=membership-codes', {
      method: 'PATCH',
      headers: authHeaders(true),
      body: JSON.stringify({ operation: 'update_batch', batchId, name, channel })
    })
    if (!response.ok) throw new Error(await readError(response))
    return response.json() as Promise<{ success: true; batch: { batch_id: string; name: string; channel: string } }>
  },

  async exportBatch(batchId: string, fallbackName = 'membership-codes') {
    const params = new URLSearchParams({ action: 'membership-codes', export: 'csv', batchId })
    const response = await fetch(`/api/admin-ops?${params.toString()}`, { headers: authHeaders() })
    if (!response.ok) throw new Error(await readError(response))
    const blob = await response.blob()
    const disposition = response.headers.get('Content-Disposition') || ''
    const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
    const fileName = encodedName ? decodeURIComponent(encodedName) : `${fallbackName}.csv`
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    URL.revokeObjectURL(url)
  }
}
