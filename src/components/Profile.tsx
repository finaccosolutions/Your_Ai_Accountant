import { useState, useEffect } from 'react';
import { User, Key, LogOut, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Profile() {
  const { profile, signOut, updateProfile } = useAuth();
  const [geminiKey, setGeminiKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.gemini_api_key) {
      setGeminiKey(profile.gemini_api_key);
    }
  }, [profile]);

  const handleSaveGeminiKey = async () => {
    setSaving(true);
    try {
      await updateProfile({ gemini_api_key: geminiKey });
      alert('Gemini API key saved successfully!');
    } catch (error) {
      console.error('Error saving API key:', error);
      alert('Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{profile?.full_name}</h2>
            <p className="text-sm opacity-90">{profile?.email}</p>
          </div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-purple-600" />
          <h3 className="font-bold text-gray-900">Gemini API Key</h3>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Add your Gemini API key to enable AI-powered features
        </p>
        <div className="space-y-3">
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="Enter your Gemini API key"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button
            onClick={handleSaveGeminiKey}
            disabled={saving}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save API Key'}
          </button>
        </div>
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-3 text-sm text-purple-600 hover:text-purple-700 underline"
        >
          Get your free Gemini API key →
        </a>
      </div>

      <button
        onClick={handleSignOut}
        className="w-full bg-red-500 text-white py-4 rounded-xl font-semibold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
      >
        <LogOut className="w-5 h-5" />
        Sign Out
      </button>
    </div>
  );
}
