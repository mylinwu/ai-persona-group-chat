
import React, { useState, useEffect } from 'react';
import ChatView from './components/ChatView';
import PersonaManagementView from './components/PersonaManagementView';
import GlobalSettings from './components/GlobalSettings';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { usePersonas } from './hooks/usePersonas';
import { useAppSettings } from './hooks/useAppSettings';
import { useConversations } from './hooks/useConversations';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { initializeAIService } from './services/aiService';

export type View = 'chat' | 'personas';

const App: React.FC = () => {
  const [view, setView] = useState<View>('chat');
  const personasHook = usePersonas();
  const { settings, setSetting } = useAppSettings();
  const conversationsHook = useConversations(personasHook.personas, settings.baseSystemPrompt);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 768);

  const activeConversation = conversationsHook.conversations.find(c => c.id === conversationsHook.activeConversationId);

  // 初始化 AI 服务
  useEffect(() => {
    initializeAIService(settings.openRouterApiKey, settings.chatModel, settings.summaryModel);
  }, [settings.openRouterApiKey, settings.chatModel, settings.summaryModel]);

  useGlobalShortcuts([
    {
      shortcut: settings.aiContinueShortcut,
      handler: () => conversationsHook.sendMessage({ nextSpeaker: 'AI_CHOICE' }),
    },
    {
      shortcut: settings.newConversationShortcut,
      handler: conversationsHook.addConversation,
      requireNoInputFocus: true,
    }
  ]);

  return (
    <div className="h-screen w-screen bg-gray-50 flex overflow-hidden font-sans text-base">
      {view === 'chat' && (
        <Sidebar 
          isOpen={isSidebarOpen} 
          setIsOpen={setIsSidebarOpen}
          newConversationShortcut={settings.newConversationShortcut}
          {...conversationsHook}
        />
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          view={view}
          setView={setView}
          activeConversationTitle={activeConversation?.title || '群聊'}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          {view === 'chat' ? (
            <ChatView 
              key={activeConversation?.id || 'no-convo'}
              conversation={activeConversation}
              personas={personasHook.personas} 
              isStretched={settings.isChatStretched}
              fontFamily={settings.fontFamily}
              fontSize={settings.fontSize}
              onSendMessage={conversationsHook.sendMessage}
              onUpdateConversation={conversationsHook.updateConversationDetails}
              isLoading={conversationsHook.isLoading}
              aiContinueShortcut={settings.aiContinueShortcut}
              settings={settings}
            />
          ) : (
            <PersonaManagementView {...personasHook} />
          )}
        </main>
      </div>
      <GlobalSettings 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        setSetting={setSetting}
      />
    </div>
  );
};

export default App;
