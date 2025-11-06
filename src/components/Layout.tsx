import { ReactNode } from 'react';
import { Home, Receipt, TrendingUp, User, Bell, Users, FileText } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  activeTab: 'home' | 'transactions' | 'shared' | 'insights' | 'reminders' | 'reports' | 'profile';
  onTabChange: (tab: 'home' | 'transactions' | 'shared' | 'insights' | 'reminders' | 'reports' | 'profile') => void;
  unreadNotifications?: number;
}

export default function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const tabs = [
    { id: 'home' as const, icon: Home, label: 'Home' },
    { id: 'transactions' as const, icon: Receipt, label: 'Txns' },
    { id: 'shared' as const, icon: Users, label: 'Split' },
    { id: 'insights' as const, icon: TrendingUp, label: 'Insights' },
    { id: 'reminders' as const, icon: Bell, label: 'Alerts' },
    { id: 'reports' as const, icon: FileText, label: 'Reports' },
    { id: 'profile' as const, icon: User, label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-emerald-50 pb-20">
      <div className="max-w-lg mx-auto">
        <div className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-10">
          <div className="flex items-center justify-between p-4">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
              SmartFinance AI
            </h1>
          </div>
        </div>

        <div className="p-4">
          {children}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200/50 z-20 safe-area-bottom">
          <div className="max-w-lg mx-auto">
            <div className="flex overflow-x-auto items-center px-4 py-2 gap-2 scrollbar-hide">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`flex flex-col items-center py-2 px-3 rounded-xl transition-all ${
                      isActive
                        ? 'bg-gradient-to-br from-blue-500 to-emerald-500 text-white shadow-lg scale-105'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className={`${isActive ? 'w-6 h-6' : 'w-5 h-5'} mb-1`} />
                    <span className={`text-[10px] font-medium whitespace-nowrap ${isActive ? 'font-semibold' : ''}`}>
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
