import { ReactNode } from 'react';
import { Home, Upload, TrendingUp, User, Bell } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  activeTab: 'home' | 'upload' | 'insights' | 'profile';
  onTabChange: (tab: 'home' | 'upload' | 'insights' | 'profile') => void;
  unreadNotifications?: number;
}

export default function Layout({ children, activeTab, onTabChange, unreadNotifications = 0 }: LayoutProps) {
  const tabs = [
    { id: 'home' as const, icon: Home, label: 'Home' },
    { id: 'upload' as const, icon: Upload, label: 'Upload' },
    { id: 'insights' as const, icon: TrendingUp, label: 'Insights' },
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
            <div className="relative">
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <Bell className="w-6 h-6 text-gray-600" />
              </button>
              {unreadNotifications > 0 && (
                <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadNotifications}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-4">
          {children}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200/50 z-20">
          <div className="max-w-lg mx-auto flex items-center justify-around py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex flex-col items-center py-2 px-4 rounded-xl transition-all ${
                    isActive
                      ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-lg transform scale-110'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-6 h-6 mb-1" />
                  <span className="text-xs font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
