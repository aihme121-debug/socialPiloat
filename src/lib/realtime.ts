// Store active connections (in production, use Redis or similar)
let activeConnections = new Map<string, any[]>();

export function broadcastUpdate(businessId: string, update: any) {
  const clients = activeConnections.get(businessId) || [];
  const encoder = new TextEncoder();
  
  clients.forEach(client => {
    try {
      const message = {
        type: 'update',
        timestamp: new Date().toISOString(),
        data: update
      };
      client.controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
    } catch (error) {
      // Client disconnected, will be cleaned up on next heartbeat
      console.log('Failed to send update to client:', client.id);
    }
  });
}

export function addConnection(businessId: string, clientInfo: any) {
  if (!activeConnections.has(businessId)) {
    activeConnections.set(businessId, []);
  }
  activeConnections.get(businessId)!.push(clientInfo);
}

export function removeConnection(businessId: string, clientId: string) {
  const clients = activeConnections.get(businessId) || [];
  activeConnections.set(businessId, clients.filter(client => client.id !== clientId));
}

export function getConnections(businessId: string) {
  return activeConnections.get(businessId) || [];
}