import React, { createContext, useContext, useState, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface CopilotState {
    resumeStructured: any | null
    resumeVersion: number
    readinessData: any | null
    readinessGeneratedAt: string | null
    currentPhase: string
    planData: any | null
    appliedCount: number
    interviewCount: number
    updatedAt: string | null
}

interface CopilotContextType {
    state: CopilotState | null
    tasks: any[]
    jobMatches: any[]
    loading: boolean
    error: string | null
    fetchState: () => Promise<void>
    callAction: (action: string, body?: any) => Promise<any>
}

const CopilotContext = createContext<CopilotContextType | null>(null)

export function useCopilot() {
    const ctx = useContext(CopilotContext)
    if (!ctx) throw new Error('useCopilot must be used within CopilotProvider')
    return ctx
}

export function CopilotProvider({ children }: { children: React.ReactNode }) {
    const { token } = useAuth()
    const [state, setState] = useState<CopilotState | null>(null)
    const [tasks, setTasks] = useState<any[]>([])
    const [jobMatches, setJobMatches] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchState = useCallback(async () => {
        if (!token) return
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/copilot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ action: 'get-state' }),
            })
            const data = await res.json()
            if (data.state) setState(data.state)
            if (data.tasks) setTasks(data.tasks)
            if (data.jobMatches) setJobMatches(data.jobMatches)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }, [token])

    const callAction = useCallback(async (action: string, body: any = {}) => {
        if (!token) throw new Error('请先登录')
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/copilot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ action, ...body }),
            })
            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.message || data.error || '请求失败')
            }
            // Auto-refresh state after mutations
            if (['extract-resume', 'assess', 'match-jobs', 'create-plan', 'update-progress'].includes(action)) {
                await fetchState()
            }
            return data
        } catch (e: any) {
            setError(e.message)
            throw e
        } finally {
            setLoading(false)
        }
    }, [token, fetchState])

    return (
        <CopilotContext.Provider value={{ state, tasks, jobMatches, loading, error, fetchState, callAction }}>
            {children}
        </CopilotContext.Provider>
    )
}
