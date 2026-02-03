'use client';

import { useState } from 'react';
import { createInvoice, getInvoice } from '@/lib/api';
import { Invoice } from '@/lib/types';

export default function ReceiveInvoice() {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInvoice(null);

    const amountNum = parseInt(amount, 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      setLoading(false);
      return;
    }

    const result = await createInvoice(amountNum, description || undefined);

    if (result.success && result.data) {
      setInvoice(result.data);
    } else {
      setError(result.error || 'Failed to create invoice');
    }

    setLoading(false);
  };

  const handleCheckStatus = async () => {
    if (!invoice) return;

    setCheckingStatus(true);
    const result = await getInvoice(invoice.payment_hash);

    if (result.success && result.data) {
      setInvoice({ ...invoice, ...result.data });
    }

    setCheckingStatus(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Receive Payment</h2>
      <p className="text-gray-600">Generate a Lightning invoice to receive payment from Node B (Bob)</p>

      <form onSubmit={handleCreateInvoice} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Amount (satoshis)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1000"
            min="1"
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Payment for..."
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating...' : 'Create Invoice'}
        </button>
      </form>

      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {invoice && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Invoice Created</h3>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                invoice.status === 'succeeded'
                  ? 'bg-green-100 text-green-800'
                  : invoice.status === 'expired'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {invoice.status?.toUpperCase() || 'PENDING'}
            </span>
          </div>

          {invoice.qr_code && (
            <div className="flex justify-center">
              <img
                src={invoice.qr_code}
                alt="Invoice QR Code"
                className="w-48 h-48"
              />
            </div>
          )}

          <div className="space-y-2">
            <div>
              <label className="block text-sm text-gray-500">Amount</label>
              <p className="font-mono">{invoice.amount} sats</p>
            </div>

            <div>
              <label className="block text-sm text-gray-500">Payment Hash</label>
              <p className="font-mono text-xs break-all">{invoice.payment_hash}</p>
            </div>

            <div>
              <label className="block text-sm text-gray-500">Invoice String</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={invoice.payment_request}
                  readOnly
                  className="flex-1 px-2 py-1 text-xs font-mono bg-white border rounded"
                />
                <button
                  onClick={() => copyToClipboard(invoice.payment_request)}
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Copy
                </button>
              </div>
            </div>

            {invoice.status === 'succeeded' && invoice.preimage && (
              <div>
                <label className="block text-sm text-gray-500">Preimage (Proof of Payment)</label>
                <p className="font-mono text-xs break-all text-green-600">{invoice.preimage}</p>
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-500">Expires At</label>
              <p className="text-sm">{new Date(invoice.expires_at).toLocaleString()}</p>
            </div>
          </div>

          <button
            onClick={handleCheckStatus}
            disabled={checkingStatus}
            className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            {checkingStatus ? 'Checking...' : 'Check Payment Status'}
          </button>
        </div>
      )}
    </div>
  );
}
