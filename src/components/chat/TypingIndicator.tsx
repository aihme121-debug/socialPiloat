interface TypingIndicatorProps {
  userName?: string;
  isMultiple?: boolean;
}

export function TypingIndicator({ userName, isMultiple }: TypingIndicatorProps) {
  const getTypingText = () => {
    if (isMultiple) {
      return 'Several people are typing...';
    } else if (userName) {
      return `${userName} is typing...`;
    }
    return 'typing...';
  };

  return (
    <div className="flex items-center space-x-1 p-3 bg-gray-100 rounded-lg max-w-fit">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <span className="text-xs text-gray-500 ml-2">{getTypingText()}</span>
    </div>
  );
}