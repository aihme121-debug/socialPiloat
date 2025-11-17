'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export default function DebugSession() {
  const { data: session, status } = useSession();
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    // Check session via API
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => setDebugInfo(data))
      .catch(err => setDebugInfo({ error: err.message }));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Session Debug</h1>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">NextAuth Session Status</h2>
        <p>Status: {status}</p>
        <pre className="bg-gray-100 p-4 rounded mt-2 text-sm">
          {JSON.stringify(session, null, 2)}
        </pre>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">API Session Check</h2>
        <pre className="bg-gray-100 p-4 rounded mt-2 text-sm">
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Social Accounts Test</h2>
        <button 
          onClick={async () => {
            try {
              const res = await fetch('/api/social-accounts');
              const data = await res.json();
              console.log('Social accounts response:', data);
              alert(`Response: ${JSON.stringify(data, null, 2)}`);
            } catch (err) {
              console.error('Error:', err);
              alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
            }
          }}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Test Social Accounts API
        </button>
      </div>
    </div>
  );
}