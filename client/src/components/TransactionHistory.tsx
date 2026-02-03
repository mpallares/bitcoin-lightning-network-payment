'use client';

import { useState, useEffect } from 'react';
import { getTransactions, getBalance } from '@/lib/api';
import { Transaction, Balance } from '@/lib/types';

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');

    const [txResult, balanceResult] = await Promise.all([
      getTransactions(),
      getBalance(),
    ]);

    if (txResult.success && txResult.data) {
      setTransactions(txResult.data.transactions);
    } else {
      setError(txResult.error || 'Failed to fetch transactions');
    }

    if (balanceResult.success && balanceResult.data) {
      setBalance(balanceResult.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'expired':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Transaction History</h2>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {balance && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">Total Received</p>
            <p className="text-2xl font-bold text-green-600">
              {balance.recorded.total_received.toLocaleString()} sats
            </p>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <p className="text-sm text-gray-600">Total Sent</p>
            <p className="text-2xl font-bold text-orange-600">
              {balance.recorded.total_sent.toLocaleString()} sats
            </p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">Net Balance</p>
            <p className="text-2xl font-bold text-blue-600">
              {balance.recorded.net_balance.toLocaleString()} sats
            </p>
          </div>
        </div>
      )}

      {transactions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No transactions yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2">Type</th>
                <th className="text-left py-3 px-2">Amount</th>
                <th className="text-left py-3 px-2">Status</th>
                <th className="text-left py-3 px-2">Payment Hash</th>
                <th className="text-left py-3 px-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.paymentHash} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-2">
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        tx.transactionType === 'invoice'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}
                    >
                      {tx.transactionType === 'invoice' ? 'Received' : 'Sent'}
                    </span>
                  </td>
                  <td className="py-3 px-2 font-mono">
                    {tx.transactionType === 'invoice' ? '+' : '-'}
                    {tx.amount.toLocaleString()} sats
                  </td>
                  <td className="py-3 px-2">
                    <span
                      className={`px-2 py-1 rounded text-sm ${getStatusColor(tx.status)}`}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className="py-3 px-2 font-mono text-xs">
                    {tx.paymentHash.slice(0, 16)}...
                  </td>
                  <td className="py-3 px-2 text-sm text-gray-600">
                    {formatDate(tx.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
