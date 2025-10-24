import React, { useState, useEffect, useRef } from 'react';
// fix: Corrected import path to resolve module.
import { Conversation } from '../types/index';
import { PlusCircleIcon, PencilSquareIcon, TrashIcon, PinIcon, CheckIcon, XMarkIcon, NoSymbolIcon, ChatBubbleOvalLeftEllipsisIcon } from './icons/Icons';
import { formatShortcut } from '../utils/shortcutFormatter';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  setActiveConversationId: (id: string) => void;
  addConversation: () => void;
  deleteConversation: (id: string) => void;
  updateConversationTitle: (id: string, title: string) => void;
  pinConversation: (id: string, pinned: boolean) => void;
  clearAllConversations: () => void;
  newConversationShortcut: string;
}

const ConversationItem: React.FC<Omit<SidebarProps, 'isOpen' | 'setIsOpen' | 'conversations' | 'clearAllConversations' | 'addConversation' | 'newConversationShortcut'> & { conversation: Conversation }> = ({
  conversation,
  activeConversationId,
  setActiveConversationId,
  deleteConversation,
  updateConversationTitle,
  pinConversation,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(conversation.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);
  
  useEffect(() => {
    setTitle(conversation.title);
  }, [conversation.title]);

  const handleSave = () => {
    if (title.trim()) {
      updateConversationTitle(conversation.id, title.trim());
    } else {
      setTitle(conversation.title); // Revert if empty
    }
    setIsEditing(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setTitle(conversation.title);
      setIsEditing(false);
    }
  }

  const isActive = conversation.id === activeConversationId;

  return (
    <div
      className={`group flex items-center p-2 rounded-md cursor-pointer transition-colors ${
        isActive ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
      onClick={() => setActiveConversationId(conversation.id)}
    >
      <ChatBubbleOvalLeftEllipsisIcon className="h-5 w-5 mr-3 flex-shrink-0" />
      {isEditing ? (
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={`flex-1 bg-transparent focus:outline-none ring-1 ${isActive ? 'ring-white/50' : 'ring-black/30'} rounded px-1 min-w-0`}
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
        />
      ) : (
        <span className="flex-1 truncate text-sm font-medium">{conversation.title}</span>
      )}
      <div className={`flex items-center ml-2 flex-shrink-0 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        {isEditing ? (
            <>
             <button onClick={(e) => { e.stopPropagation(); handleSave();}} className="p-1 hover:bg-white/20 rounded"><CheckIcon className="h-4 w-4" /></button>
             <button onClick={(e) => { e.stopPropagation(); setIsEditing(false); setTitle(conversation.title); }} className="p-1 hover:bg-white/20 rounded"><XMarkIcon className="h-4 w-4" /></button>
            </>
        ) : (
            <>
                <button onClick={(e) => { e.stopPropagation(); pinConversation(conversation.id, !conversation.pinned); }} className="p-1 hover:bg-white/20 rounded" title={conversation.pinned ? "取消置顶" : "置顶"}>
                    <PinIcon className={`h-4 w-4 ${conversation.pinned ? (isActive ? 'text-yellow-300' : 'text-yellow-500') : ''}`} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="p-1 hover:bg-white/20 rounded" title="重命名"><PencilSquareIcon className="h-4 w-4" /></button>
                <button onClick={(e) => { e.stopPropagation(); deleteConversation(conversation.id); }} className="p-1 hover:bg-white/20 rounded" title="删除"><TrashIcon className="h-4 w-4" /></button>
            </>
        )}
      </div>
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = (props) => {
  const { isOpen, setIsOpen, conversations, newConversationShortcut } = props;

  const sortedConversations = [...conversations].sort(
    (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt - a.createdAt
  );
  
  return (
    <>
      {/* Backdrop for mobile, shown when isOpen. md:hidden ensures it's only on mobile. */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* The Sidebar itself */}
      <aside
        className={`
          bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden
          
          /* --- Mobile styles (default) --- */
          fixed inset-y-0 left-0 z-30
          w-72
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}

          /* --- Desktop styles (md and up) --- */
          md:relative md:inset-auto md:translate-x-0
          md:flex-shrink-0
          md:transition-all 
          md:${isOpen ? 'w-72' : 'w-0'}
        `}
      >
        {/* Inner container to prevent content squeezing on desktop */}
        <div
          className={`
            w-72 h-full flex flex-col flex-shrink-0
            opacity-100 transition-opacity duration-200
            md:${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
          `}
        >
          <div className="h-16 px-4 flex-shrink-0 flex items-center">
             <h2 className="text-lg font-semibold text-gray-800">会话列表</h2>
          </div>
          <hr className="border-gray-200 shrink-0" />
          <div className="flex-1 p-2 space-y-1 overflow-y-auto min-h-0">
            {sortedConversations.map(conv => (
            <ConversationItem key={conv.id} conversation={conv} {...props} />
            ))}
          </div>
          <div className="p-2 border-t border-gray-200 space-y-2 flex-shrink-0">
            <button
            onClick={props.addConversation}
            title={`快捷键: ${formatShortcut(newConversationShortcut)}`}
            className="w-full flex items-center justify-center gap-2 p-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors text-sm font-medium"
            >
            <PlusCircleIcon className="h-5 w-5" />
            新对话
            </button>
            <button
            onClick={props.clearAllConversations}
            className="w-full flex items-center justify-center gap-2 p-2 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors text-sm font-medium"
            >
            <NoSymbolIcon className="h-5 w-5" />
            清空所有
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;