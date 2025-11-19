import { useToast } from '@/hooks/use-toast'

export interface NotificationConfig {
  title: string
  description: string
  variant?: 'default' | 'destructive'
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

export class NotificationService {
  private static instance: NotificationService
  private toast: any

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  setToast(toast: any) {
    this.toast = toast
  }

  success(config: NotificationConfig) {
    if (this.toast) {
      this.toast({
        title: config.title,
        description: config.description,
        variant: config.variant || 'default',
        duration: config.duration || 5000,
        action: config.action
      })
    }
  }

  error(config: NotificationConfig) {
    if (this.toast) {
      this.toast({
        title: config.title,
        description: config.description,
        variant: 'destructive',
        duration: config.duration || 8000,
        action: config.action
      })
    }
  }

  warning(config: NotificationConfig) {
    if (this.toast) {
      this.toast({
        title: config.title,
        description: config.description,
        variant: 'default',
        duration: config.duration || 6000,
        action: config.action
      })
    }
  }

  info(config: NotificationConfig) {
    if (this.toast) {
      this.toast({
        title: config.title,
        description: config.description,
        variant: 'default',
        duration: config.duration || 5000,
        action: config.action
      })
    }
  }

  // Facebook-specific notifications
  facebookConnectionSuccess(pagesCount?: number) {
    this.success({
      title: 'Facebook Connected Successfully',
      description: pagesCount ? `Connected and found ${pagesCount} pages` : 'Facebook account connected successfully',
      duration: 6000
    })
  }

  facebookConnectionError(error: string) {
    this.error({
      title: 'Facebook Connection Failed',
      description: error,
      duration: 8000,
      action: {
        label: 'Retry',
        onClick: () => window.location.reload()
      }
    })
  }

  facebookTokenExpired() {
    this.warning({
      title: 'Facebook Token Expired',
      description: 'Your Facebook connection has expired. Please reconnect your account.',
      duration: 10000,
      action: {
        label: 'Reconnect',
        onClick: () => {
          // Trigger reconnection flow
          window.location.href = '/api/auth/facebook/connect'
        }
      }
    })
  }

  facebookPermissionError() {
    this.error({
      title: 'Insufficient Facebook Permissions',
      description: 'Your Facebook account doesn\'t have the required permissions. Please check your page roles.',
      duration: 8000,
      action: {
        label: 'Learn More',
        onClick: () => {
          window.open('https://developers.facebook.com/docs/pages/access-tokens', '_blank')
        }
      }
    })
  }

  webhookSubscriptionSuccess(pageName: string) {
    this.success({
      title: 'Webhook Subscribed',
      description: `Successfully subscribed to webhook events for ${pageName}`,
      duration: 5000
    })
  }

  webhookSubscriptionError(pageName: string, error: string) {
    this.error({
      title: 'Webhook Subscription Failed',
      description: `Failed to subscribe to ${pageName}: ${error}`,
      duration: 7000
    })
  }

  messageSentSuccess(recipient: string) {
    this.success({
      title: 'Message Sent',
      description: `Successfully sent message to ${recipient}`,
      duration: 4000
    })
  }

  messageSendError(recipient: string, error: string) {
    this.error({
      title: 'Failed to Send Message',
      description: `Could not send message to ${recipient}: ${error}`,
      duration: 7000
    })
  }

  postCreatedSuccess(postId: string) {
    this.success({
      title: 'Post Created',
      description: 'Your post has been created successfully',
      duration: 5000,
      action: {
        label: 'View Post',
        onClick: () => {
          window.open(`https://facebook.com/${postId}`, '_blank')
        }
      }
    })
  }

  postCreationError(error: string) {
    this.error({
      title: 'Failed to Create Post',
      description: error,
      duration: 7000
    })
  }

  commentReplySuccess() {
    this.success({
      title: 'Reply Sent',
      description: 'Your reply has been sent successfully',
      duration: 4000
    })
  }

  commentReplyError(error: string) {
    this.error({
      title: 'Failed to Reply',
      description: error,
      duration: 7000
    })
  }

  rateLimitWarning() {
    this.warning({
      title: 'Rate Limit Warning',
      description: 'You\'re approaching Facebook\'s rate limit. Please slow down your requests.',
      duration: 6000
    })
  }

  systemError(operation: string, error: string) {
    this.error({
      title: 'System Error',
      description: `Failed to ${operation}: ${error}`,
      duration: 8000,
      action: {
        label: 'Report Issue',
        onClick: () => {
          // Open support ticket or feedback form
          console.error('System error reported:', { operation, error })
        }
      }
    })
  }

  networkError() {
    this.error({
      title: 'Network Error',
      description: 'Unable to connect to the server. Please check your internet connection.',
      duration: 8000,
      action: {
        label: 'Retry',
        onClick: () => window.location.reload()
      }
    })
  }
}

export const notificationService = NotificationService.getInstance()