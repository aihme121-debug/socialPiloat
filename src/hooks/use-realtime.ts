import { useEffect, useState, useRef } from 'react';

interface RealTimeUpdate {
  type: string;
  timestamp: string;
  data: any;
}

interface UseRealTimeOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onUpdate?: (update: RealTimeUpdate) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useRealTime(options: UseRealTimeOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<RealTimeUpdate | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const {
    onConnect,
    onDisconnect,
    onUpdate,
    reconnectInterval = 5000,
    maxReconnectAttempts = 5
  } = options;

  const connect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource('/api/realtime');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        setReconnectAttempts(0);
        onConnect?.();
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'connection') {
            setConnectionId(data.clientId);
          } else if (data.type === 'update') {
            setLastUpdate(data);
            onUpdate?.(data);
          }
          // Ignore heartbeat messages for state updates
        } catch (error) {
          console.error('Error parsing real-time update:', error);
        }
      };

      eventSource.onerror = (error) => {
        setIsConnected(false);
        onDisconnect?.();
        
        // Attempt reconnection if not at max attempts
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, reconnectInterval);
        }
      };
    } catch (error) {
      console.error('Error establishing real-time connection:', error);
      setIsConnected(false);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionId(null);
    onDisconnect?.();
  };

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, []);

  return {
    isConnected,
    connectionId,
    lastUpdate,
    reconnectAttempts,
    connect,
    disconnect
  };
}