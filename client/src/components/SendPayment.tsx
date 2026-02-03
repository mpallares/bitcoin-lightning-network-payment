'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { decodeInvoice, payInvoice } from '@/lib/api';
import { DecodedInvoice, Payment } from '@/lib/types';

export default function SendPayment() {
  const queryClient = useQueryClient();
  const [invoiceString, setInvoiceString] = useState('');
  const [decodedInvoice, setDecodedInvoice] = useState<DecodedInvoice | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [error, setError] = useState('');

  const handleDecode = async () => {
    if (!invoiceString.trim()) {
      setError('Please enter an invoice');
      return;
    }

    setDecoding(true);
    setError('');
    setDecodedInvoice(null);
    setPayment(null);

    const result = await decodeInvoice(invoiceString.trim());

    if (result.success && result.data) {
      setDecodedInvoice(result.data);
    } else {
      setError(result.error || 'Failed to decode invoice');
    }

    setDecoding(false);
  };

  const handlePay = async () => {
    if (!invoiceString.trim()) return;

    setLoading(true);
    setError('');

    const result = await payInvoice(invoiceString.trim());

    if (result.success && result.data) {
      setPayment(result.data);
      // Invalidate transactions and balance cache after payment
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    } else {
      setError(result.error || 'Payment failed');
    }

    setLoading(false);
  };

  const isExpired = decodedInvoice ? new Date(decodedInvoice.expires_at) < new Date() : false;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-700">Send Payment</h2>
      <p className="text-gray-700">Pay a Lightning invoice from Node B (Bob)</p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">Invoice String</label>
          <textarea
            value={invoiceString}
            onChange={(e) => {
              setInvoiceString(e.target.value);
              setDecodedInvoice(null);
              setPayment(null);
              setError('');
            }}
            placeholder="lnbcrt..."
            rows={4}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm outline-none text-gray-500 border-gray-300"
          />
        </div>

        <button
          onClick={handleDecode}
          disabled={decoding || !invoiceString.trim()}
          className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {decoding ? 'Decoding...' : 'Decode Invoice'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {decodedInvoice && !payment && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-700">Invoice Details</h3>

          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium text-gray-800">Amount</label>
              <p className="font-mono text-xl text-gray-500">{decodedInvoice.amount} sats</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-800">Description</label>
              <p className="text-gray-500">{decodedInvoice.description || 'No description'}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-800">Payment Hash</label>
              <p className="font-mono text-xs break-all text-gray-500">{decodedInvoice.payment_hash}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-800">Destination</label>
              <p className="font-mono text-xs break-all text-gray-500">{decodedInvoice.destination}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-800">Expires At</label>
              <p className={`text-sm text-gray-500 ${isExpired ? 'text-red-600' : ''}`}>
                {new Date(decodedInvoice.expires_at).toLocaleString()}
                {isExpired && ' (EXPIRED)'}
              </p>
            </div>
          </div>

          <button
            onClick={handlePay}
            disabled={loading || isExpired}
            className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {loading ? 'Processing Payment...' : `Pay ${decodedInvoice.amount} sats`}
          </button>
        </div>
      )}

      {payment && (
        <div className={`space-y-4 p-4 rounded-lg ${
          payment.status === 'succeeded' ? 'bg-green-50' : 'bg-red-50'
        }`}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Payment Result</h3>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                payment.status === 'succeeded'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {payment.status.toUpperCase()}
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium text-gray-800">Amount Paid</label>
              <p className="font-mono text-gray-500">{payment.amount} sats</p>
            </div>

            {payment.fee > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-800">Routing Fee</label>
                <p className="font-mono text-gray-500">{payment.fee} sats</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-800">Payment Hash</label>
              <p className="font-mono text-xs break-all text-gray-500">{payment.payment_hash}</p>
            </div>

            {payment.preimage && (
              <div>
                <label className="block text-sm font-medium text-gray-800">Preimage (Proof of Payment)</label>
                <p className="font-mono text-xs break-all text-green-600">{payment.preimage}</p>
              </div>
            )}

            {payment.error && (
              <div>
                <label className="block text-sm font-medium text-gray-800">Error</label>
                <p className="text-red-600">{payment.error}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
