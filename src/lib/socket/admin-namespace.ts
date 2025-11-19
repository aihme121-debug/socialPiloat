import { Server as SocketIOServer } from 'socket.io'
import { systemMonitor } from '@/lib/system/system-monitor'
import { logger } from '@/lib/logging/logger-service'

export function setupAdminNamespace(io: SocketIOServer) {
  const adminNamespace = io.of('/admin')

  adminNamespace.on('connection', (socket) => {
    logger.info('Admin dashboard connected', { socketId: socket.id })

    // Send current system status
    socket.emit('system-status', {
      status: systemMonitor.getSystemStatus()
    })

    // Send current system logs
    socket.emit('system-logs', {
      logs: systemMonitor.getSystemLogs()
    })

    // Handle status requests
    socket.on('get-system-status', () => {
      socket.emit('system-status', {
        status: systemMonitor.getSystemStatus()
      })
    })

    socket.on('get-system-logs', () => {
      socket.emit('system-logs', {
        logs: systemMonitor.getSystemLogs()
      })
    })

    // Handle connection events
    socket.on('disconnect', (reason) => {
      logger.info('Admin dashboard disconnected', { 
        socketId: socket.id, 
        reason 
      })
    })

    socket.on('error', (error) => {
      logger.error('Admin dashboard socket error', error instanceof Error ? error : undefined, { 
        socketId: socket.id, 
        error: error instanceof Error ? error.message : String(error)
      })
    })
  })

  // Broadcast system status updates to all admin dashboards
  systemMonitor.on('status-update', (data) => {
    adminNamespace.emit('system-status', { status: data })
  })

  // Broadcast new logs to all admin dashboards
  systemMonitor.on('new-log', (log) => {
    adminNamespace.emit('new-log', { log })
  })

  // Broadcast Facebook-specific events
  systemMonitor.on('facebook-webhook', (data) => {
    adminNamespace.emit('facebook-webhook', data)
  })

  systemMonitor.on('facebook-api-connected', (data) => {
    adminNamespace.emit('facebook-api-connected', data)
  })

  systemMonitor.on('facebook-api-error', (data) => {
    adminNamespace.emit('facebook-api-error', data)
  })

  logger.info('Admin namespace initialized')
}