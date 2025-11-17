import { Check, CheckCheck } from 'lucide-react';

interface MessageStatusProps {
  status: 'sent' | 'delivered' | 'read' | 'failed';
  size?: number;
}

export function MessageStatus({ status, size = 16 }: MessageStatusProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'sent':
        return <Check size={size} className="text-gray-400" />;
      case 'delivered':
        return <CheckCheck size={size} className="text-gray-400" />;
      case 'read':
        return <CheckCheck size={size} className="text-blue-500" />;
      case 'failed':
        return <span className="text-red-500 text-xs">!</span>;
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center ml-1">
      {getStatusIcon()}
    </div>
  );
}