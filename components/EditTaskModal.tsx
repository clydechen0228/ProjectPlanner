import React, { useState, useEffect } from 'react';
import { X, Trash2, Calendar, Link as LinkIcon, Save, AlertTriangle, CornerDownRight } from 'lucide-react';
import { Task, TaskType, TASK_TYPE_LABELS, TYPE_COLORS } from '../types';

interface EditTaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Task) => void;
  onDelete: (id: number) => void;
  allTasks: Task[];
}

export const EditTaskModal: React.FC<EditTaskModalProps> = ({ 
  task, 
  isOpen, 
  onClose, 
  onSave, 
  onDelete, 
  allTasks 
}) => {
  const [formData, setFormData] = useState<Task | null>(null);

  useEffect(() => {
    if (task) {
      setFormData({ ...task, dependencies: task.dependencies || [] });
    }
  }, [task]);

  if (!isOpen || !formData) return null;

  const handleChange = (field: keyof Task, value: any) => {
    setFormData(prev => prev ? { ...prev, [field]: value } : null);
  };

  const toggleDependency = (depId: number) => {
    setFormData(prev => {
        if (!prev) return null;
        const currentDeps = prev.dependencies || [];
        const newDeps = currentDeps.includes(depId)
            ? currentDeps.filter(id => id !== depId)
            : [...currentDeps, depId];
        return { ...prev, dependencies: newDeps };
    });
  };

  const handleSave = () => {
    if (formData) {
        onSave(formData);
    }
  };

  const handleDelete = () => {
      // Logic handled in App.tsx which provides the confirm dialog and toast
      if (formData) {
          onDelete(formData.id);
          onClose();
      }
  };

  // Helper to prevent circular parent selection
  const isValidParent = (potentialParentId: number) => {
      if (potentialParentId === formData.id) return false;
      return true; 
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Edit Task</h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {formData.id}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          
          {/* Main Info */}
          <div className="space-y-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task Name</label>
                <input 
                    type="text" 
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full text-lg font-semibold text-slate-700 border-b-2 border-slate-200 focus:border-blue-500 focus:outline-none py-1 transition-colors bg-transparent placeholder-slate-300"
                    placeholder="Enter task name..."
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Parent Task</label>
                    <div className="relative">
                        <select 
                            value={formData.parentId || ''}
                            onChange={(e) => handleChange('parentId', e.target.value ? Number(e.target.value) : undefined)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none appearance-none"
                        >
                            <option value="">(No Parent - Root Task)</option>
                            {allTasks.filter(t => isValidParent(t.id)).map(t => (
                                <option key={t.id} value={t.id}>#{t.id} {t.name}</option>
                            ))}
                        </select>
                        <CornerDownRight className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" size={14} />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task Type</label>
                    <select 
                        value={formData.type}
                        onChange={(e) => handleChange('type', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none appearance-none"
                    >
                        {Object.entries(TASK_TYPE_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                    <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-200">
                        {['todo', 'in-progress', 'done'].map((status) => (
                            <button
                                key={status}
                                onClick={() => handleChange('status', status)}
                                className={`flex-1 capitalize text-xs font-medium py-1.5 rounded-md transition-all ${
                                    formData.status === status 
                                    ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' 
                                    : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                {status.replace('-', ' ')}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Owner</label>
                    <input 
                        value={formData.owner}
                        onChange={(e) => handleChange('owner', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                        <div className="relative">
                            <input 
                                type="date"
                                value={formData.start}
                                onChange={(e) => handleChange('start', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                            />
                            <Calendar className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" size={14} />
                        </div>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
                        <div className="relative">
                            <input 
                                type="date"
                                value={formData.end}
                                onChange={(e) => handleChange('end', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                            />
                            <Calendar className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" size={14} />
                        </div>
                     </div>
            </div>
          </div>

          {/* Dependencies Section */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <LinkIcon size={16} className="text-slate-400"/> 
                Dependencies (Predecessors)
            </h3>
            <div className="max-h-40 overflow-y-auto custom-scrollbar pr-2 space-y-1">
                {allTasks.filter(t => t.id !== formData.id).map(t => (
                    <label key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all cursor-pointer group">
                        <input 
                            type="checkbox"
                            checked={formData.dependencies?.includes(t.id)}
                            onChange={() => toggleDependency(t.id)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                                <span className={`text-xs font-medium truncate ${formData.dependencies?.includes(t.id) ? 'text-slate-900' : 'text-slate-500'}`}>
                                    {t.name}
                                </span>
                                <span className="text-[10px] font-mono text-slate-300 group-hover:text-slate-400">#{t.id}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${TYPE_COLORS[t.type].split(' ')[0]}`}></span>
                                {t.start}
                            </div>
                        </div>
                    </label>
                ))}
                {allTasks.length <= 1 && <div className="text-xs text-slate-400 italic text-center py-2">No other tasks available to link.</div>}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <button 
                onClick={handleDelete}
                className="flex items-center gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
                <Trash2 size={16} /> Delete
            </button>
            <div className="flex gap-3">
                <button 
                    onClick={onClose}
                    className="px-4 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-md hover:shadow-lg transition-all text-sm font-bold"
                >
                    <Save size={16} /> Save Changes
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};