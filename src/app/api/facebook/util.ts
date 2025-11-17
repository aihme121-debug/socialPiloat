import { prisma } from '@/lib/prisma'

export async function getPageAccess(sessionUserId: string, pageId?: string) {
  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { businessId: true }
  })
  if (!user?.businessId) return { error: 'No business associated' }
  const account = await prisma.socialAccount.findFirst({
    where: { businessId: user.businessId, platform: 'FACEBOOK', isActive: true }
  })
  if (!account) return { error: 'No connected Facebook account' }
  const settings: any = account.settings || {}
  const pages: any[] = Array.isArray(settings.pages) ? settings.pages : []
  let target = pages[0]
  if (pageId) {
    const found = pages.find((p) => p.id === pageId)
    if (found) target = found
  }
  if (!target) return { error: 'No page available' }
  const token = target.access_token || account.accessToken
  return { businessId: user.businessId, account, page: target, accessToken: token }
}

export async function graphGet(path: string) {
  const res = await fetch(path)
  const json = await res.json()
  if (!res.ok) return { ok: false, data: json }
  return { ok: true, data: json }
}