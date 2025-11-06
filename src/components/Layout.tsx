import { ReactNode } from 'react';
import { Home, Upload, TrendingUp, User, Bell as BellIcon, Calendar, Users } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  activeTab: 'home' | 'daily' | 'upload' | 'shared' | 'insights' | 'reminders' | 'profile';
  onTabChange: (tab: 'home' | 'daily' | 'upload' | 'shared' | 'insights' | 'reminders' | 'profile') => void;
  unreadNotifications?: number;
}

export default function Layout({ children, activeTab, onTabChange, unreadNotifications = 0 }: LayoutProps) {
  const tabs = [
    { id: 'home' as const, icon: Home, label: 'Home' },
    { id: 'daily' as const, icon: Calendar, label: 'Daily' },
    { id: 'upload' as const, icon: Upload, label: 'Upload' },
    { id: 'shared' as const, icon: Users, label: 'Split' },
    { id: 'insights' as const, icon: TrendingUp, label: 'Insights' },
    { id: 'reminders' as const, icon: BellIcon, label: 'Alerts' },
    { id: 'profile' as const, icon: User, label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 pb-20">
      <div className="max-w-lg mx-auto">
        <div className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-10">
          <div className="flex items-center justify-between p-4">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              SmartFinance AI
            </h1>
          </div>
        </div>

        <div className="p-4">
          {children}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200/50 z-20 overflow-x-auto">
          <div className="max-w-lg mx-auto flex gap-1 py-2 px-2 min-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex flex-col items-center py-2 px-3 rounded-xl transition-all flex-shrink-0 ${
                    isActive
                      ? 'bg-gradient-to-br from-blue-500 to-emerald-500 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className={`${isActive ? 'w-5 h-5' : 'w-4 h-4'} mb-1`} />
                  <span className="text-[9px] font-medium whitespace-nowrap">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
