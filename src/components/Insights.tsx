import { useState, useEffect } from 'react';
import { TrendingUp, AlertTriangle, Info, Sparkles, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FinancialInsight, Transaction, Category } from '../lib/types';
import { AIService } from '../services/aiService';

export default function Insights() {
  const { user, profile } = useAuth();
  const [insights, setInsights] = useState<FinancialInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (user) {
      loadInsights();
    }
  }, [user]);

  const loadInsights = async () => {
    try {
      const { data, error } = await supabase
        .from('financial_insights')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      if (data) setInsights(data);
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateNewInsights = async () => {
    if (!profile?.gemini_api_key) {
      alert('Please add your Gemini API key in Profile settings first');
      return;
    }

    setGenerating(true);

    try {
      const [transactionsResult, categoriesResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user!.id)
          .eq('is_approved', true)
          .gte('transaction_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
        supabase.from('categories').select('*').or(`user_id.eq.${user!.id},is_system.eq.true`),
      ]);

      if (!transactionsResult.data || transactionsResult.data.length === 0) {
        alert('No transactions found. Please upload and approve some transactions first.');
        return;
      }

      const aiService = new AIService(profile.gemini_api_key);
      const newInsights = await aiService.generateInsights(
        transactionsResult.data as Transaction[],
        categoriesResult.data as Category[]
      );

      const insightsToInsert = newInsights.map((insight) => ({
        user_id: user!.id,
        insight_type: insight.type,
        title: insight.title,
        description: insight.description,
        severity: insight.severity,
        data: insight.data || {},
        is_read: false,
      }));

      const { error } = await supabase.from('financial_insights').insert(insightsToInsert);

      if (error) throw error;

      await loadInsights();
    } catch (error) {
      console.error('Error generating insights:', error);
      alert('Failed to generate insights. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const markAsRead = async (insightId: string) => {
    try {
      await supabase
        .from('financial_insights')
        .update({ is_read: true })
        .eq('id', insightId);

      setInsights(insights.map(i => i.id === insightId ? { ...i, is_read: true } : i));
    } catch (error) {
      console.error('Error marking insight as read:', error);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'spending_pattern':
        return TrendingUp;
      case 'budget_alert':
        return AlertTriangle;
      case 'prediction':
        return Sparkles;
      case 'recommendation':
        return Info;
      default:
        return Info;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'from-red-500 to-red-600';
      case 'warning':
        return 'from-yellow-500 to-orange-500';
      case 'info':
        return 'from-blue-500 to-purple-500';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-8 h-8" />
          <h2 className="text-2xl font-bold">AI Financial Insights</h2>
        </div>
        <p className="text-sm opacity-90">
          Get personalized financial advice powered by AI
        </p>
      </div>

      <button
        onClick={generateNewInsights}
        disabled={generating || !profile?.gemini_api_key}
        className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {generating ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            Generating Insights...
          </>
        ) : (
          <>
            <RefreshCw className="w-5 h-5" />
            Generate New Insights
          </>
        )}
      </button>

      {!profile?.gemini_api_key && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="w-5 h-5" />
            <p className="font-medium">
              Please add your Gemini API key in Profile settings to generate insights
            </p>
          </div>
        </div>
      )}

      {insights.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-8 text-center shadow-lg">
          <Sparkles className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Insights Yet</h3>
          <p className="text-gray-600">
            Click "Generate New Insights" to get AI-powered financial advice
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => {
            const Icon = getInsightIcon(insight.insight_type);
            const severityColor = getSeverityColor(insight.severity);

            return (
              <div
                key={insight.id}
                className={`bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg ${
                  !insight.is_read ? 'ring-2 ring-purple-400' : ''
                }`}
                onClick={() => !insight.is_read && markAsRead(insight.id)}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${severityColor} flex-shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-gray-900 text-lg">{insight.title}</h3>
                      {!insight.is_read && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 leading-relaxed mb-3">{insight.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {new Date(insight.created_at).toLocaleDateString()}
                      </span>
                      <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                        insight.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        insight.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {insight.insight_type.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <h4 className="font-semibold text-blue-900 mb-2">About AI Insights:</h4>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>• Analyzes your spending patterns and financial behavior</li>
          <li>• Provides personalized recommendations</li>
          <li>• Predicts future trends based on your history</li>
          <li>• Alerts you to unusual spending or potential issues</li>
          <li>• Helps you achieve better financial health</li>
        </ul>
      </div>
    </div>
  );
}
