'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTransactions, getBalance } from '@/lib/api';

const ITEMS_PER_PAGE = 10;

export default function TransactionHistory() {
  const [page, setPage] = useState(1);

  const {
    data: txData,
    isLoading: txLoading,
    error: txError,
    refetch: refetchTx,
  } = useQuery({
    queryKey: ['transactions', page],
    queryFn: async () => {
      const result = await getTransactions(page, ITEMS_PER_PAGE);
      if (!result.success) throw new Error(result.error || 'Failed to fetch transactions');
      return result.data;
    },
  });

  const {
    data: balance,
    refetch: refetchBalance,
  } = useQuery({
    queryKey: ['balance'],
    queryFn: async () => {
      const result = await getBalance();
      if (!result.success) throw new Error(result.error || 'Failed to fetch balance');
      return result.data;
    },
  });

  const transactions = txData?.transactions ?? [];
  const pagination = txData?.pagination;

  const handleRefresh = () => {
    refetchTx();
    refetchBalance();
  };

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

  if (txLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-700">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-700">Transaction History</h2>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-gray-600 rounded-lg text-white font-semibold hover:bg-gray-700"
        >
          Refresh
        </button>
      </div>

      {txError && (
        <div className="p-4 bg-red-100 text-red-700 rounded-lg">
          {txError.message}
        </div>
      )}

      {balance && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm font-medium text-gray-800">Total Received</p>
            <p className="text-2xl font-bold text-green-700">
              {balance.recorded.total_received.toLocaleString()} sats
            </p>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <p className="text-sm font-medium text-gray-800">Total Sent</p>
            <p className="text-2xl font-bold text-orange-700">
              {balance.recorded.total_sent.toLocaleString()} sats
            </p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-gray-800">Net Balance</p>
            <p className="text-2xl font-bold text-blue-700">
              {balance.recorded.net_balance.toLocaleString()} sats
            </p>
          </div>
        </div>
      )}

      {transactions.length === 0 ? (
        <div className="text-center py-12 text-gray-700">
          No transactions yet
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-100">
                  <th className="text-left py-3 px-2 font-semibold text-gray-900">Type</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-900">Amount</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-900">Status</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-900">Payment Hash</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-900">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={`${tx.paymentHash}-${tx.transactionType}`} className="border-b hover:bg-gray-50">
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
                    <td className="py-3 px-2 font-mono text-gray-700">
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
                    <td className="py-3 px-2 font-mono text-xs text-gray-700">
                      {tx.paymentHash.slice(0, 16)}...
                    </td>
                    <td className="py-3 px-2 text-sm text-gray-700">
                      {formatDate(tx.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm text-gray-700">
                Showing {((page - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(page * ITEMS_PER_PAGE, pagination.total)} of {pagination.total} transactions
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 1)
                    .map((p, idx, arr) => (
                      <span key={p} className="flex items-center">
                        {idx > 0 && arr[idx - 1] !== p - 1 && (
                          <span className="px-1 text-gray-500">...</span>
                        )}
                        <button
                          onClick={() => setPage(p)}
                          className={`px-3 py-1 rounded text-sm font-medium ${
                            p === page
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {p}
                        </button>
                      </span>
                    ))}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="px-3 py-1 border rounded text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
