import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import {
  paypalPaymentClient,
  type PayPalCaptureResult,
  type PayPalOrder,
  type PayPalPublicConfig
} from '../services/paypal-payment-service'

type PayPalSdk = {
  findEligibleMethods: (options: { currencyCode: string }) => Promise<{ isEligible: (method: string) => boolean }>
  createPayPalOneTimePaymentSession: (callbacks: {
    onApprove: (data: { orderId: string }) => Promise<void> | void
    onCancel: () => void
    onError: (error: unknown) => void
  }) => { start: (options: { presentationMode: 'auto' }, orderId: Promise<string>) => Promise<void> }
}

declare global {
  interface Window {
    paypal?: {
      createInstance: (options: { clientId: string; components: string[]; pageType: string }) => Promise<PayPalSdk>
    }
  }
}

let sdkPromise: Promise<void> | null = null
let loadedSdkUrl = ''

function loadSdk(url: string) {
  if (window.paypal?.createInstance && loadedSdkUrl === url) return Promise.resolve()
  if (sdkPromise && loadedSdkUrl === url) return sdkPromise
  loadedSdkUrl = url
  sdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-haigoo-paypal-sdk="v6"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('PayPal SDK 加载失败')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = url
    script.async = true
    script.dataset.haigooPaypalSdk = 'v6'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('PayPal SDK 加载失败'))
    document.head.appendChild(script)
  })
  return sdkPromise
}

interface Props {
  planId: string
  disabled?: boolean
  onCreated?: (order: PayPalOrder) => void
  onSuccess: (result: PayPalCaptureResult) => Promise<void> | void
  onPending: (result?: PayPalCaptureResult) => void
  onCancel?: () => void
}

type CheckoutState = 'loading' | 'ready' | 'opening' | 'capturing' | 'pending' | 'error' | 'disabled'

export default function PayPalCheckoutButton({ planId, disabled, onCreated, onSuccess, onPending, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const currentOrderRef = useRef<PayPalOrder | null>(null)
  const [state, setState] = useState<CheckoutState>('loading')
  const [message, setMessage] = useState('正在加载 PayPal…')
  const [config, setConfig] = useState<PayPalPublicConfig | null>(null)

  useEffect(() => {
    let cancelled = false
    let button: HTMLElement | null = null
    let clickHandler: (() => Promise<void>) | null = null

    const initialize = async () => {
      try {
        setState('loading')
        setMessage('正在加载 PayPal…')
        const nextConfig = await paypalPaymentClient.config()
        if (cancelled) return
        setConfig(nextConfig)
        if (!nextConfig.enabled || !nextConfig.clientId || disabled) {
          setState('disabled')
          setMessage('当前暂不支持 PayPal 在线付款')
          return
        }
        await loadSdk(nextConfig.sdkUrl)
        if (cancelled || !window.paypal?.createInstance) return
        const sdk = await window.paypal.createInstance({
          clientId: nextConfig.clientId,
          components: ['paypal-payments'],
          pageType: 'checkout'
        })
        const methods = await sdk.findEligibleMethods({ currencyCode: nextConfig.currency })
        if (!methods.isEligible('paypal')) {
          setState('disabled')
          setMessage('当前环境暂时无法使用 PayPal，请选择顾问协助开通')
          return
        }
        const session = sdk.createPayPalOneTimePaymentSession({
          onApprove: async ({ orderId }) => {
            const order = currentOrderRef.current
            if (!order || order.paypalOrderId !== orderId) {
              setState('error')
              setMessage('订单信息发生变化，请刷新后重试')
              return
            }
            setState('capturing')
            setMessage('付款已完成，正在更新会员权益…')
            try {
              const result = await paypalPaymentClient.captureOrder(order.paymentId, orderId)
              if (result.pending) {
                setState('pending')
                setMessage('付款结果正在确认中，请勿重复付款')
                onPending(result)
                return
              }
              await onSuccess(result)
            } catch (captureError) {
              const typed = captureError as Error & { code?: string; status?: number }
              if (typed.code === 'PAYPAL_CAPTURE_UNKNOWN' || typed.status === 202) {
                setState('pending')
                setMessage('付款结果正在确认中，请勿重复付款')
                onPending()
              } else {
                setState('error')
                setMessage(typed.message || '付款确认失败，请稍后重试')
              }
            }
          },
          onCancel: () => {
            setState('ready')
            setMessage('你已取消付款，可以稍后继续')
            onCancel?.()
          },
          onError: () => {
            setState('error')
            setMessage('暂时无法打开 PayPal，请稍后重试或联系顾问')
          }
        })
        button = document.createElement('paypal-button')
        button.setAttribute('type', 'pay')
        button.setAttribute('aria-label', '使用 PayPal 付款')
        button.className = 'block min-h-[48px] w-full'
        clickHandler = async () => {
          try {
            setState('opening')
            setMessage('正在打开 PayPal…')
            const orderPromise = paypalPaymentClient.createOrder(planId).then(order => {
              currentOrderRef.current = order
              onCreated?.(order)
              return order.paypalOrderId
            })
            await session.start({ presentationMode: 'auto' }, orderPromise)
          } catch (checkoutError) {
            setState('error')
            setMessage(checkoutError instanceof Error ? checkoutError.message : '无法创建支付订单')
          }
        }
        button.addEventListener('click', clickHandler)
        if (containerRef.current) {
          containerRef.current.replaceChildren(button)
        }
        setState('ready')
        setMessage(nextConfig.environment === 'sandbox' ? '当前为测试环境，不会产生真实扣款' : '使用 PayPal 完成付款')
      } catch (setupError) {
        if (cancelled) return
        setState('error')
        setMessage(setupError instanceof Error ? setupError.message : '支付组件加载失败')
      }
    }
    void initialize()
    return () => {
      cancelled = true
      if (button && clickHandler) button.removeEventListener('click', clickHandler)
    }
  }, [disabled, onCancel, onCreated, onPending, onSuccess, planId])

  const busy = ['loading', 'opening', 'capturing'].includes(state)
  return (
    <div className="w-full">
      <div className={busy || state === 'pending' ? 'pointer-events-none opacity-60' : ''} ref={containerRef} />
      {state === 'disabled' ? (
        <div className="flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-[#dbe3ea] bg-slate-50 px-5 text-sm font-black text-slate-500">
          <ShieldCheck className="h-4 w-4" />{message}
        </div>
      ) : null}
      <div className={`mt-3 flex items-center justify-center gap-2 text-xs font-semibold ${state === 'error' ? 'text-rose-600' : state === 'pending' ? 'text-amber-700' : 'text-slate-400'}`}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : state === 'error' || state === 'pending' ? <AlertCircle className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
        <span>{message}</span>
        {config?.environment === 'sandbox' && state === 'ready' ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">测试环境</span> : null}
      </div>
    </div>
  )
}
