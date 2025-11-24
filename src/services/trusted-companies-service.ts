// Helper to get token from storage
const getAuthToken = () => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('haigoo_auth_token') || ''
    }
    return ''
}

export interface TrustedCompany {
    id: string
    name: string
    website: string
    careersPage: string
    linkedin?: string
    description?: string
    logo?: string
    tags?: string[]
    createdAt: string
    updatedAt: string
    isTrusted: boolean
}

export const trustedCompaniesService = {
    async getAllCompanies(): Promise<TrustedCompany[]> {
        const response = await fetch('/api/data/trusted-companies')
        if (!response.ok) throw new Error('Failed to fetch companies')
        const data = await response.json()
        return data.companies || []
    },

    async getCompanyById(id: string): Promise<TrustedCompany> {
        const response = await fetch(`/api/data/trusted-companies?id=${id}`)
        if (!response.ok) throw new Error('Failed to fetch company')
        const data = await response.json()
        return data.company
    },

    async saveCompany(company: Partial<TrustedCompany>): Promise<void> {
        const token = getAuthToken()
        const response = await fetch('/api/data/trusted-companies', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(company)
        })
        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to save company')
        }
    },

    async deleteCompany(id: string): Promise<void> {
        const token = getAuthToken()
        const response = await fetch(`/api/data/trusted-companies?id=${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        if (!response.ok) throw new Error('Failed to delete company')
    },

    async fetchMetadata(url: string): Promise<{ title: string; description: string; image: string; icon: string }> {
        const token = getAuthToken()
        const response = await fetch('/api/data/trusted-companies?action=crawl', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ url })
        })
        if (!response.ok) throw new Error('Failed to fetch metadata')
        const data = await response.json()
        return data.metadata
    }
}
