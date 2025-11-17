'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Users, 
  UserPlus, 
  Mail, 
  UserCheck, 
  UserX, 
  Clock,
  Copy,
  RefreshCw,
  Trash2,
  Shield,
  Calendar
} from 'lucide-react'

interface TeamInvitation {
  id: string
  email: string
  name: string
  role: string
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED'
  expiresAt: string
  createdAt: string
  token: string
  invitedByUser: {
    name: string
    email: string
  }
}

interface TeamMember {
  id: string
  email: string
  name: string
  role: string
  avatar?: string
  isActive: boolean
  lastLogin?: string
  createdAt: string
}

const ROLE_CONFIGS = {
  SUPER_ADMIN: { name: 'Super Admin', color: 'bg-red-100 text-red-800', icon: Shield },
  TENANT_ADMIN: { name: 'Tenant Admin', color: 'bg-purple-100 text-purple-800', icon: Shield },
  ORGANIZATION_ADMIN: { name: 'Organization Admin', color: 'bg-blue-100 text-blue-800', icon: Shield },
  TEAM_MANAGER: { name: 'Team Manager', color: 'bg-green-100 text-green-800', icon: Users },
  CONTENT_CREATOR: { name: 'Content Creator', color: 'bg-yellow-100 text-yellow-800', icon: Calendar },
  SOCIAL_MEDIA_MANAGER: { name: 'Social Media Manager', color: 'bg-pink-100 text-pink-800', icon: Users },
  ANALYST: { name: 'Analyst', color: 'bg-indigo-100 text-indigo-800', icon: UserCheck },
  VIEWER: { name: 'Viewer', color: 'bg-gray-100 text-gray-800', icon: UserCheck }
}

const STATUS_CONFIGS = {
  PENDING: { name: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  ACCEPTED: { name: 'Accepted', color: 'bg-green-100 text-green-800', icon: UserCheck },
  EXPIRED: { name: 'Expired', color: 'bg-red-100 text-red-800', icon: UserX },
  CANCELLED: { name: 'Cancelled', color: 'bg-gray-100 text-gray-800', icon: UserX }
}

export default function TeamManagementPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<TeamInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showInviteForm, setShowInviteForm] = useState(false)
  
  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('VIEWER')
  const [inviteLoading, setInviteLoading] = useState(false)

  useEffect(() => {
    if (session?.user?.id) {
      fetchTeamData()
    }
  }, [session])

  const fetchTeamData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch team members
      const membersResponse = await fetch('/api/team/members')
      if (!membersResponse.ok) throw new Error('Failed to fetch team members')
      const membersData = await membersResponse.json()
      setTeamMembers(membersData.members)

      // Fetch invitations
      const invitationsResponse = await fetch('/api/team/invite')
      if (invitationsResponse.ok) {
        const invitationsData = await invitationsResponse.json()
        setInvitations(invitationsData.invitations || [])
      } else if (invitationsResponse.status === 403 || invitationsResponse.status === 401) {
        // Lack of permission or unauthenticated: show empty invitations without erroring
        setInvitations([])
      } else {
        const errText = await invitationsResponse.text()
        throw new Error(errText || 'Failed to fetch invitations')
      }

    } catch (error) {
      console.error('Error fetching team data:', error)
      setError(`Failed to load team data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleInviteTeamMember = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!inviteEmail || !inviteName || !inviteRole) {
      setError('Please fill in all fields')
      return
    }

    try {
      setInviteLoading(true)
      setError(null)

      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName,
          role: inviteRole
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation')
      }

      setSuccess(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      setInviteName('')
      setInviteRole('VIEWER')
      setShowInviteForm(false)
      
      // Refresh data
      fetchTeamData()

    } catch (error) {
      console.error('Error sending invitation:', error)
      setError(`Failed to send invitation: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setInviteLoading(false)
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/team/invite/${invitationId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to cancel invitation')

      setSuccess('Invitation cancelled successfully')
      fetchTeamData()

    } catch (error) {
      console.error('Error cancelling invitation:', error)
      setError(`Failed to cancel invitation: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleResendInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/team/invite/${invitationId}/resend`, {
        method: 'POST',
      })

      if (!response.ok) throw new Error('Failed to resend invitation')

      setSuccess('Invitation resent successfully')
      fetchTeamData()

    } catch (error) {
      console.error('Error resending invitation:', error)
      setError(`Failed to resend invitation: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const copyInvitationLink = (token: string) => {
    const invitationUrl = `${window.location.origin}/auth/invite?token=${token}`
    navigator.clipboard.writeText(invitationUrl)
    setSuccess('Invitation link copied to clipboard')
  }

  const getRoleConfig = (role: string) => ROLE_CONFIGS[role as keyof typeof ROLE_CONFIGS] || ROLE_CONFIGS.VIEWER
  const getStatusConfig = (status: string) => STATUS_CONFIGS[status as keyof typeof STATUS_CONFIGS] || STATUS_CONFIGS.PENDING

  if (!session?.user?.id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Loading...</h2>
          <p className="text-gray-600 dark:text-gray-400">Please wait while we load your session.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Team Management</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your team members and invitations
            </p>
          </div>
          <Button 
            onClick={() => setShowInviteForm(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Invite Team Member
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Invite Form Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Invite Team Member</h2>
              <button
                onClick={() => setShowInviteForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <UserX className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleInviteTeamMember} className="space-y-4">
              <div>
                <Label htmlFor="inviteEmail">Email Address</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="inviteName">Full Name</Label>
                <Input
                  id="inviteName"
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="inviteRole">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger id="inviteRole">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIEWER">Viewer - Read-only access</SelectItem>
                    <SelectItem value="ANALYST">Analyst - View analytics</SelectItem>
                    <SelectItem value="CONTENT_CREATOR">Content Creator - Create content</SelectItem>
                    <SelectItem value="SOCIAL_MEDIA_MANAGER">Social Media Manager - Manage posts</SelectItem>
                    <SelectItem value="TEAM_MANAGER">Team Manager - Manage team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInviteForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={inviteLoading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600"
                >
                  {inviteLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('members')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'members'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Team Members ({teamMembers.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('invitations')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'invitations'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <Mail className="w-4 h-4 mr-2" />
                Invitations ({invitations.filter(inv => inv.status === 'PENDING').length})
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading team data...</p>
        </div>
      ) : (
        <>
          {activeTab === 'members' && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {teamMembers.map((member) => {
                const roleConfig = getRoleConfig(member.role)
                const RoleIcon = roleConfig.icon
                
                return (
                  <Card key={member.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{member.name}</CardTitle>
                            <CardDescription>{member.email}</CardDescription>
                          </div>
                        </div>
                        <Badge className={roleConfig.color}>
                          <RoleIcon className="w-3 h-3 mr-1" />
                          {roleConfig.name}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center justify-between">
                          <span>Status:</span>
                          <Badge variant={member.isActive ? "default" : "secondary"}>
                            {member.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Last Login:</span>
                          <span>{member.lastLogin ? new Date(member.lastLogin).toLocaleDateString() : 'Never'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Member Since:</span>
                          <span>{new Date(member.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {activeTab === 'invitations' && (
            <div className="space-y-4">
              {invitations.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Invitations</h3>
                    <p className="text-gray-600 dark:text-gray-400">You haven't sent any team invitations yet.</p>
                  </CardContent>
                </Card>
              ) : (
                invitations.map((invitation) => {
                  const statusConfig = getStatusConfig(invitation.status)
                  const roleConfig = getRoleConfig(invitation.role)
                  const StatusIcon = statusConfig.icon
                  const RoleIcon = roleConfig.icon
                  
                  return (
                    <Card key={invitation.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                              {invitation.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-white">{invitation.name}</h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{invitation.email}</p>
                              <div className="flex items-center space-x-2 mt-1">
                                <Badge className={roleConfig.color}>
                                  <RoleIcon className="w-3 h-3 mr-1" />
                                  {roleConfig.name}
                                </Badge>
                                <Badge className={statusConfig.color}>
                                  <StatusIcon className="w-3 h-3 mr-1" />
                                  {statusConfig.name}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            {invitation.status === 'PENDING' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => copyInvitationLink(invitation.token)}
                                  className="flex items-center"
                                >
                                  <Copy className="w-3 h-3 mr-1" />
                                  Copy Link
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleResendInvitation(invitation.id)}
                                  className="flex items-center"
                                >
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                  Resend
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCancelInvitation(invitation.id)}
                                  className="flex items-center text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Cancel
                                </Button>
                              </>
                            )}
                            
                            <div className="text-right text-sm text-gray-500">
                              <div>Expires: {new Date(invitation.expiresAt).toLocaleDateString()}</div>
                              <div>Invited by: {invitation.invitedByUser.name}</div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}