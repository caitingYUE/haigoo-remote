/**
 * Google Identity Services TypeScript 类型定义
 */

interface GoogleAccountsId {
  initialize(config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }): void
  
  prompt(momentListener?: (notification: PromptMomentNotification) => void): void
  
  renderButton(
    parent: HTMLElement,
    options: {
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'large' | 'medium' | 'small'
      type?: 'standard' | 'icon'
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
      shape?: 'rectangular' | 'pill' | 'circle' | 'square'
      logo_alignment?: 'left' | 'center'
      width?: number
      locale?: string
    }
  ): void
  
  disableAutoSelect(): void
  
  cancel(): void
  
  revoke(hint: string, callback: (done: RevocationResponse) => void): void
}

interface GoogleCredentialResponse {
  credential: string
  select_by: string
  clientId?: string
}

interface PromptMomentNotification {
  isDisplayMoment(): boolean
  isDisplayed(): boolean
  isNotDisplayed(): boolean
  getNotDisplayedReason(): string
  isSkippedMoment(): boolean
  getSkippedReason(): string
  isDismissedMoment(): boolean
  getDismissedReason(): string
  getMomentType(): string
}

interface RevocationResponse {
  successful: boolean
  error?: string
}

interface Window {
  google?: {
    accounts: {
      id: GoogleAccountsId
    }
  }
}

