
import React from 'react';
import { View } from '../App';
import { UsersIcon, ChatBubbleLeftRightIcon, Cog6ToothIcon, Bars3Icon } from './icons/Icons';

interface HeaderProps {
    view: View;
    setView: (view: View) => void;
    activeConversationTitle: string;
    onToggleSidebar: () => void;
    onOpenSettings: () => void;
}

const Header: React.FC<HeaderProps> = ({ view, setView, activeConversationTitle, onToggleSidebar, onOpenSettings }) => {
    return (
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-gray-200 flex-shrink-0">
            <div className="w-full mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center gap-2 min-w-0">
                        {view === 'chat' && (
                            <button
                                onClick={onToggleSidebar}
                                className="p-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                                aria-label="Toggle Sidebar"
                            >
                                <Bars3Icon className="h-6 w-6" />
                            </button>
                        )}
                        <h1 className="text-xl font-bold text-gray-900 truncate pr-2">
                            {view === 'chat' ? activeConversationTitle : '人设管理'}
                        </h1>
                    </div>
                    <nav className="flex items-center gap-2">
                        <button
                            onClick={() => setView('chat')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${view === 'chat'
                                    ? 'bg-blue-500 text-white'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }`}
                        >
                            <ChatBubbleLeftRightIcon className="h-5 w-5" />
                            <span className="hidden sm:inline">聊天</span>
                        </button>
                        <button
                            onClick={() => setView('personas')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${view === 'personas'
                                    ? 'bg-blue-500 text-white'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }`}
                        >
                            <UsersIcon className="h-5 w-5" />
                            <span className="hidden sm:inline">人设管理</span>
                        </button>
                        <button
                            onClick={onOpenSettings}
                            className="p-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                            aria-label="Global Settings"
                        >
                            <Cog6ToothIcon className="h-5 w-5" />
                        </button>
                    </nav>
                </div>
            </div>
        </header>
    );
};

export default Header;
