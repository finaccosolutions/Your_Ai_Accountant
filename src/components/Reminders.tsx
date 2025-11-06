import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, Calendar, DollarSign, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Reminder } from '../lib/types';

export default function Reminders() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const [formData, setFormData] = useState({
    type: 'payment_due' as const,
    title: '',
    description: '',
    amount: '',
    due_date: '',
    send_via: [] as string[],
    is_recurring: false,
    recurrence_pattern: 'monthly',
  });

  useEffect(() => {
    if (user) {
      loadReminders();
    }
  }, [user]);

  const loadReminders = async () => {
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user!.id)
        .order('due_date', { ascending: true });

      if (error) throw error;
      if (data) setReminders(data);
    } catch (error) {
      console.error('Error loading reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase.from('reminders').insert({
        user_id: user!.id,
        type: formData.type,
        title: formData.title,
        description: formData.description,
        amount: formData.amount ? parseFloat(formData.amount) : null,
        due_date: formData.due_date || null,
        send_via: formData.send_via,
        is_recurring: formData.is_recurring,
        recurrence_pattern: formData.is_recurring ? formData.recurrence_pattern : null,
      });

      if (error) throw error;

      await loadReminders();
      setShowAddForm(false);
      setFormData({
        type: 'payment_due',
        title: '',
        description: '',
        amount: '',
        due_date: '',
        send_via: [],
        is_recurring: false,
        recurrence_pattern: 'monthly',
      });
    } catch (error) {
      console.error('Error creating reminder:', error);
      alert('Failed to create reminder');
    }
  };

  const handleDelete = async (reminderId: string) => {
    if (!confirm('Are you sure you want to delete this reminder?')) return;

    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', reminderId);

      if (error) throw error;
      await loadReminders();
    } catch (error) {
      console.error('Error deleting reminder:', error);
    }
  };

  const toggleSendVia = (method: string) => {
    if (formData.send_via.includes(method)) {
      setFormData({
        ...formData,
        send_via: formData.send_via.filter(m => m !== method),
      });
    } else {
      setFormData({
        ...formData,
        send_via: [...formData.send_via, method],
      });
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'payment_due':
        return 'bg-red-100 text-red-700';
      case 'collection':
        return 'bg-green-100 text-green-700';
      case 'budget_alert':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Reminders</h2>
            <p className="text-sm opacity-90">
              Never miss a payment or collection
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Create Reminder</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="payment_due">Payment Due</option>
                  <option value="collection">Collection</option>
                  <option value="budget_alert">Budget Alert</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Electricity Bill"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  rows={3}
                  placeholder="Additional details..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (Optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="₹ 0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Send Reminder Via (Coming Soon)
                </label>
                <div className="flex gap-3">
                  {['whatsapp', 'sms', 'email'].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => toggleSendVia(method)}
                      className={`px-4 py-2 rounded-xl font-medium transition-all ${
                        formData.send_via.includes(method)
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {method.charAt(0).toUpperCase() + method.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_recurring}
                    onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Recurring Reminder</span>
                </label>
              </div>

              {formData.is_recurring && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recurrence Pattern
                  </label>
                  <select
                    value={formData.recurrence_pattern}
                    onChange={(e) => setFormData({ ...formData, recurrence_pattern: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all"
              >
                Create Reminder
              </button>
            </form>
          </div>
        </div>
      )}

      {reminders.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-8 text-center shadow-lg">
          <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Reminders</h3>
          <p className="text-gray-600">Create your first reminder to stay on track</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reminders.map((reminder) => (
            <div
              key={reminder.id}
              className="bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-lg"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(reminder.type)}`}>
                      {reminder.type.replace('_', ' ').toUpperCase()}
                    </span>
                    {reminder.is_recurring && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        {reminder.recurrence_pattern?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg">{reminder.title}</h3>
                  {reminder.description && (
                    <p className="text-gray-600 text-sm mt-1">{reminder.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(reminder.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600">
                {reminder.amount && (
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="font-medium">₹{reminder.amount.toLocaleString()}</span>
                  </div>
                )}
                {reminder.due_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(reminder.due_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {reminder.send_via && reminder.send_via.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Notify via: {reminder.send_via.join(', ')}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Note:</h4>
        <p className="text-sm text-blue-800">
          Reminder notifications via WhatsApp, SMS, and Email are coming soon. For now, you can view all your reminders here.
        </p>
      </div>
    </div>
  );
}
