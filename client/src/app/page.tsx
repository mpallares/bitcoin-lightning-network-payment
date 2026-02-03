'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReceiveInvoice from '@/components/ReceiveInvoice';
import SendPayment from '@/components/SendPayment';
import TransactionHistory from '@/components/TransactionHistory';
import { getNodes } from '@/lib/api';

type Tab = 'receive' | 'send' | 'history';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('receive');

  const { data: nodes, isLoading, isError } = useQuery({
    queryKey: ['nodes'],
    queryFn: async () => {
      const result = await getNodes();
      if (!result.success) throw new Error(result.error || 'Failed to fetch nodes');
      return result.data;
    },
    retry: 2,
  });

  const connected = isLoading ? null : isError ? false : true;

  const tabs: { id: Tab; label: string; description: string }[] = [
    { id: 'receive', label: 'Receive', description: 'Generate invoice (Alice)' },
    { id: 'send', label: 'Send', description: 'Pay invoice (Bob)' },
    { id: 'history', label: 'History', description: 'View transactions' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Lightning Network Payments</h1>
          <p className="mt-1 text-gray-700">
            Send and receive payments over the Lightning Network
          </p>

          {/* Connection Status */}
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  connected === true
                    ? 'bg-green-500'
                    : connected === false
                    ? 'bg-red-500'
                    : 'bg-yellow-500'
                }`}
              />
              <span className="text-sm text-gray-600">
                {connected === true
                  ? 'Connected to nodes'
                  : connected === false
                  ? 'Not connected'
                  : 'Checking...'}
              </span>
            </div>

            {nodes && (
              <div className="text-sm text-gray-700">
                Alice: {nodes.node_a.alias} | Bob: {nodes.node_b.alias}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex border-b mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-700 hover:text-gray-700'
              }`}
            >
              <span>{tab.label}</span>
              <span className="hidden sm:inline text-xs ml-2 text-gray-600">
                ({tab.description})
              </span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow p-6">
          {activeTab === 'receive' && <ReceiveInvoice />}
          {activeTab === 'send' && <SendPayment />}
          {activeTab === 'history' && <TransactionHistory />}
        </div>

        {/* Info Section */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-800">How it works</h3>
          <div className="mt-2 text-sm text-blue-700 space-y-1">
            <p><strong>Receive:</strong> Node A (Alice) generates invoices to receive payments</p>
            <p><strong>Send:</strong> Node B (Bob) pays invoices using channel balance</p>
            <p><strong>History:</strong> View all transactions stored in the database</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-gray-700 text-sm">
        Lightning Network Payment Demo
      </footer>
    </div>
  );
}
