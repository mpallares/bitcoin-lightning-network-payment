'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import { createInvoice } from '@/lib/api';
import { Invoice } from '@/lib/types';
import { getSocket, InvoiceUpdateEvent } from '@/lib/socket';

export default function ReceiveInvoice() {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Listen for real-time invoice updates via WebSocket
  useEffect(() => {
    const socket = getSocket();

    const handleInvoiceUpdate = (data: InvoiceUpdateEvent) => {
      // Only update if it's for our current invoice
      if (invoice && data.payment_hash === invoice.payment_hash) {
        setInvoice((prev) =>
          prev
            ? {
                ...prev,
                status: data.status,
                preimage: data.preimage || prev.preimage,
              }
            : null,
        );

        // Refresh transactions and balance when paid
        if (data.status === 'succeeded') {
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
          queryClient.invalidateQueries({ queryKey: ['balance'] });
        }
      }
    };

    socket.on('invoice:updated', handleInvoiceUpdate);

    return () => {
      socket.off('invoice:updated', handleInvoiceUpdate);
    };
  }, [invoice, queryClient]);

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
      // Invalidate transactions cache so History tab shows the new invoice
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    } else {
      setError(result.error || 'Failed to create invoice');
    }

    setLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className='space-y-6'>
      <h2 className='text-2xl font-bold text-gray-700'>Receive Payment</h2>
      <p className='text-gray-700'>
        Generate a Lightning invoice to receive payment from Node B (Bob)
      </p>

      <form onSubmit={handleCreateInvoice} className='space-y-4'>
        <div>
          <label className='block text-sm font-semibold text-gray-900 mb-1'>
            Amount (satoshis)
          </label>
          <input
            type='number'
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder='1000'
            min='1'
            className='text-gray-500 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none focus:border-transparent border-gray-300'
            required
          />
        </div>

        <div>
          <label className='block text-sm font-semibold text-gray-900 mb-1'>
            Description (optional)
          </label>
          <input
            type='text'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder='Payment for...'
            className='border-gray-300 outline-none text-gray-500 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
          />
        </div>

        <button
          type='submit'
          disabled={loading}
          className='w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
        >
          {loading ? 'Creating...' : 'Create Invoice'}
        </button>
      </form>

      {error && (
        <div className='p-4 bg-red-100 text-red-700 rounded-lg'>{error}</div>
      )}

      {invoice && (
        <div className='space-y-4 p-4 bg-gray-50 rounded-lg'>
          <div className='flex items-center justify-between'>
            <h3 className='text-lg font-semibold text-gray-800'>
              Invoice Created
            </h3>
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
            <div className='flex justify-center'>
              <Image
                src={invoice.qr_code}
                alt='Invoice QR Code'
                width={192}
                height={192}
                unoptimized
              />
            </div>
          )}

          <div className='space-y-2'>
            <div>
              <label className='block text-sm font-medium text-gray-800'>
                Amount
              </label>
              <p className='font-mono text-gray-500'>{invoice.amount} sats</p>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-800'>
                Payment Hash
              </label>
              <p className='font-mono text-xs break-all text-gray-500'>
                {invoice.payment_hash}
              </p>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-800'>
                Invoice String
              </label>
              <div className='flex gap-2'>
                <input
                  type='text'
                  value={invoice.payment_request}
                  readOnly
                  className='text-gray-500 flex-1 px-2 py-1 text-xs font-mono bg-white border rounded'
                />
                <button
                  onClick={() => copyToClipboard(invoice.payment_request)}
                  className={`px-3 py-1 rounded-lg text-white font-semibold ${
                    copied ? 'bg-green-600' : 'bg-gray-600 hover:bg-gray-700'
                  }`}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {invoice.status === 'succeeded' && invoice.preimage && (
              <div>
                <label className='block text-sm font-medium text-gray-800'>
                  Preimage (Proof of Payment)
                </label>
                <p className='font-mono text-xs break-all text-green-600'>
                  {invoice.preimage}
                </p>
              </div>
            )}

            <div>
              <label className='block text-sm font-medium text-gray-800'>
                Expires At
              </label>
              <p className='text-sm text-gray-500'>
                {new Date(invoice.expires_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
