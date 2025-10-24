import React, { useState, useRef } from 'react';
// fix: Corrected import path to resolve module.
import { Persona, AvatarConfig } from '../types/index';
import PersonaAvatar from './PersonaAvatar';
import { PlusIcon, PencilIcon, TrashIcon, CheckIcon, XMarkIcon, ArrowUpTrayIcon, ArrowDownTrayIcon } from './icons/Icons';
// fix: Corrected import path to resolve module.
import { PRESET_ICONS, PRESET_BG_COLORS, DEFAULT_AVATAR } from '../constants/index';

interface PersonaManagementViewProps {
  personas: Persona[];
  addPersona: (persona: Omit<Persona, 'id'>) => void;
  updatePersona: (persona: Persona) => void;
  deletePersona: (id: string) => void;
  setPersonas: (personas: Persona[]) => void;
}

const AvatarEditor: React.FC<{
  value: AvatarConfig;
  onChange: (value: AvatarConfig) => void;
}> = ({ value, onChange }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <PersonaAvatar src={value} name="Preview" size="md" />
        <div className="flex-1">
          <label className="text-sm font-medium text-gray-500">图标 (可自定义)</label>
          <div className="mt-1 space-y-2">
             <input
                type="text"
                value={value.icon}
                onChange={(e) => {
                  const emoji = e.target.value ? Array.from(e.target.value)[0] : '😀';
                  onChange({ ...value, icon: emoji });
                }}
                placeholder="😀"
                className="w-full bg-gray-50 border border-gray-300 rounded-md px-3 py-2 text-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
              />
            <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
              {PRESET_ICONS.map(icon => (
                <button type="button" key={icon} onClick={() => onChange({ ...value, icon })} className={`text-2xl rounded-md p-1 transition-transform transform hover:scale-110 ${value.icon === icon ? 'bg-blue-200 ring-2 ring-blue-500' : 'bg-gray-100'}`}>
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-500">背景颜色</label>
        <div className="mt-1 grid grid-cols-10 gap-2">
          {PRESET_BG_COLORS.map(bgColor => (
            <button type="button" key={bgColor} onClick={() => onChange({ ...value, bgColor })} style={{ backgroundColor: bgColor }} className={`h-8 w-8 rounded-md transition-transform transform hover:scale-110 ${value.bgColor === bgColor ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`} />
          ))}
        </div>
      </div>
    </div>
  );
};

const PersonaCard: React.FC<{
  persona: Persona;
  onUpdate: (persona: Persona) => void;
  onDelete: (id: string) => void;
}> = ({ persona, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPersona, setEditedPersona] = useState(persona);

  const handleSave = () => {
    onUpdate(editedPersona);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedPersona(persona);
    setIsEditing(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEditedPersona({ ...editedPersona, [e.target.name]: e.target.value });
  };
  
  if (isEditing) {
    return (
      <div className="bg-white rounded-lg p-4 flex flex-col gap-4 border border-blue-500 shadow-md">
        <input name="name" value={editedPersona.name} onChange={handleChange} className="text-lg font-bold bg-gray-100 w-full p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900" autoComplete="off" spellCheck={false} autoCapitalize="none" />
        
        <AvatarEditor value={editedPersona.avatar} onChange={avatar => setEditedPersona({...editedPersona, avatar})} />

        <div>
          <label className="text-sm font-medium text-gray-500">人设提示词 (可选)</label>
          <textarea name="prompt" value={editedPersona.prompt} onChange={handleChange} rows={5} className="mt-1 bg-gray-100 w-full p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900" autoComplete="off" spellCheck={false} />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={handleCancel} className="p-2 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-800"><XMarkIcon className="h-5 w-5"/></button>
          <button onClick={handleSave} className="p-2 bg-green-500 hover:bg-green-600 rounded-md text-white"><CheckIcon className="h-5 w-5"/></button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-4 flex flex-col gap-3 border border-gray-200 shadow-sm">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <PersonaAvatar src={persona.avatar} name={persona.name} />
          <h3 className="text-lg font-bold text-gray-900">{persona.name}</h3>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsEditing(true)} className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-md"><PencilIcon className="h-5 w-5"/></button>
          <button onClick={() => onDelete(persona.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"><TrashIcon className="h-5 w-5"/></button>
        </div>
      </div>
      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md overflow-hidden text-ellipsis line-clamp-3 border border-gray-200/50">{persona.prompt || <span className="italic text-gray-400">未设置提示词</span>}</p>
    </div>
  );
};


const PersonaManagementView: React.FC<PersonaManagementViewProps> = ({
  personas,
  addPersona,
  updatePersona,
  deletePersona,
  setPersonas
}) => {
  const [newPersona, setNewPersona] = useState({ name: '', avatar: DEFAULT_AVATAR, prompt: '' });
  const [isAdding, setIsAdding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    if (newPersona.name.trim()) {
      addPersona({ ...newPersona, name: newPersona.name.trim() });
      setNewPersona({ name: '', avatar: DEFAULT_AVATAR, prompt: '' });
      setIsAdding(false);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(personas, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ai_personas.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error("文件内容无法读取");
        const imported = JSON.parse(text);

        // Add validation for new avatar format
        const isValid = imported.every((p: any) => 
            'id' in p && 'name' in p && 'prompt' in p && 'avatar' in p &&
            'icon' in p.avatar && 'bgColor' in p.avatar && 'color' in p.avatar
        );

        if (!Array.isArray(imported) || !isValid) {
          throw new Error("无效的人设文件格式或版本过旧。");
        }

        if (window.confirm("这将替换您所有当前的人设。要继续吗？")) {
          setPersonas(imported);
          alert("人设导入成功！");
        }
      } catch (error) {
        alert(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };
  
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-900">人设管理</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" autoComplete="off" />
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors shadow-sm border border-gray-300">
              <ArrowUpTrayIcon className="h-5 w-5"/> 导入
            </button>
            <button onClick={handleExport} className="flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors shadow-sm border border-gray-300">
              <ArrowDownTrayIcon className="h-5 w-5"/> 导出
            </button>
            {!isAdding && <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow-sm"><PlusIcon className="h-5 w-5"/> 添加新人设</button>}
          </div>
        </div>

        {isAdding && (
          <div className="bg-white rounded-lg p-4 mb-6 flex flex-col gap-4 border border-blue-500 shadow-md">
            <h3 className="text-lg font-bold text-gray-900">添加新人设</h3>
            <input name="name" value={newPersona.name} onChange={(e) => setNewPersona({...newPersona, name: e.target.value})} placeholder="名称 (必填)" className="bg-gray-100 w-full p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" autoComplete="off" spellCheck={false} autoCapitalize="none" />
            
            <AvatarEditor value={newPersona.avatar} onChange={avatar => setNewPersona({...newPersona, avatar})} />

            <textarea name="prompt" value={newPersona.prompt} onChange={(e) => setNewPersona({...newPersona, prompt: e.target.value})} placeholder="人设提示词 (可选)" rows={4} className="bg-gray-100 w-full p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" autoComplete="off" spellCheck={false} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsAdding(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-lg">取消</button>
              <button onClick={handleAdd} disabled={!newPersona.name.trim()} className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg disabled:bg-green-300 disabled:cursor-not-allowed">保存</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {personas.map((persona) => (
            <PersonaCard key={persona.id} persona={persona} onUpdate={updatePersona} onDelete={deletePersona} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PersonaManagementView;