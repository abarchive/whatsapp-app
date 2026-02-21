import { useState } from 'react';
import { X, Copy, Check, AlertTriangle, Key } from 'lucide-react';

export default function PasswordResetModal({ isOpen, onClose, userEmail, temporaryPassword }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Key size={20} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Password Reset</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Success Message */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-green-800 font-medium">
              Password has been reset for <span className="font-semibold">{userEmail}</span>
            </p>
          </div>

          {/* Password Display */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Temporary Password
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-100 border border-gray-300 rounded-lg px-4 py-3 font-mono text-lg tracking-wider select-all">
                {temporaryPassword}
              </div>
              <button
                onClick={handleCopy}
                data-testid="copy-password-btn"
                className={`px-4 py-3 rounded-lg font-medium flex items-center gap-2 transition-all duration-200 ${
                  copied
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {copied ? (
                  <>
                    <Check size={18} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={18} />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-amber-800 font-semibold text-sm">Important!</p>
              <p className="text-amber-700 text-sm mt-1">
                This password will <strong>not be shown again</strong>. Please copy it now and share it securely with the user.
              </p>
              <p className="text-amber-600 text-xs mt-2">
                The user will be required to change this password on their next login.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
