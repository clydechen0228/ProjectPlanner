import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, GitBranchPlus } from 'lucide-react';
import { Task } from '../types';
import { generateProjectPlan, generateSubtasks } from '../services/ai';
import { useToast } from '../context/ToastContext';

interface AIGenerateModalProps {
  isOpen: boolean;
  mode: 'plan' | 'subtasks';
  parentTask?: Task | null;
  onClose: () => void;
  onPlanGenerated: (tasks: Task[]) => void;
}

export const AIGenerateModal: React.FC<AIGenerateModalProps> = ({
  isOpen,
  mode,
  parentTask,
  onClose,
  onPlanGenerated
}) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      setPrompt('');
    }
  }, [isOpen, mode]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    try {
      let tasks: Task[] = [];
      
      if (mode === 'subtasks' && parentTask) {
        tasks = await generateSubtasks(parentTask, prompt);
      } else {
        tasks = await generateProjectPlan(prompt);
      }

      onPlanGenerated(tasks);
      toast.success(mode === 'subtasks' ? `Generated ${tasks.length} subtasks!` : `Plan generated with ${tasks.length} tasks!`);
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQuickPrompt = (text: string) => {
    setPrompt(text);
  };

  if (!isOpen) return null;

  const isSubtaskMode = mode === 'subtasks' && parentTask;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className={`px-6 py-5 border-b border-slate-100 flex justify-between items-center ${isSubtaskMode ? 'bg-gradient-to-r from-blue-50 to-cyan-50' : 'bg-gradient-to-r from-indigo-50 to-purple-50'}`}>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            {isSubtaskMode ? (
               <>
                 <GitBranchPlus className="text-blue-600" size={24}/>
                 AI Subtask Generator
               </>
            ) : (
               <>
                 <Sparkles className="text-indigo-600 fill-indigo-100" size={24}/> 
                 AI Plan Generator
               </>
            )}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white/50 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {isSubtaskMode ? (
             <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-800 font-medium">Parent Task:</p>
                <div className="font-bold text-slate-700 text-sm">{parentTask.name}</div>
                <div className="text-xs text-slate-500">{parentTask.start} to {parentTask.end}</div>
             </div>
          ) : (
             <p className="text-sm text-slate-600 mb-4 leading-relaxed">
               Describe your project timeline. The AI will generate a structured Gantt chart with dependencies.
             </p>
          )}

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={isSubtaskMode 
                ? "e.g. Break this down into 3 phases: Design, Implementation, and Testing. Make sure to include a review step." 
                : "e.g. Create a 4-week cutover plan for a SAP migration starting April 1st. Include data freeze, code deployment, and 3 batches of user migration."
            }
            className="w-full h-40 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none resize-none transition-all placeholder:text-slate-400"
            disabled={isGenerating}
          />

          {/* Quick Prompts */}
          <div className="mt-4">
            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Quick Templates</label>
            <div className="flex flex-wrap gap-2">
               {isSubtaskMode ? (
                 <>
                   <button 
                    onClick={() => handleQuickPrompt("Break down into: Preparation, Execution, and Verification steps.")}
                    className="text-xs bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 px-3 py-1.5 rounded-full transition-colors border border-transparent hover:border-blue-100"
                   >
                     Standard Breakdown
                   </button>
                   <button 
                    onClick={() => handleQuickPrompt("Create daily tasks for this week-long activity.")}
                    className="text-xs bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 px-3 py-1.5 rounded-full transition-colors border border-transparent hover:border-blue-100"
                   >
                     Daily Tasks
                   </button>
                 </>
               ) : (
                 <>
                   <button 
                    onClick={() => handleQuickPrompt("Standard Software Launch: 2 weeks dev, 1 week QA, 3 days UAT, Go-Live weekend.")}
                    className="text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 px-3 py-1.5 rounded-full transition-colors border border-transparent hover:border-indigo-100"
                   >
                     Software Launch
                   </button>
                   <button 
                    onClick={() => handleQuickPrompt("Data Center Migration: 3 months. Inventory, Planning, Hardware Setup, Data Sync, Cutover.")}
                    className="text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 px-3 py-1.5 rounded-full transition-colors border border-transparent hover:border-indigo-100"
                   >
                     DC Migration
                   </button>
                 </>
               )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium"
            disabled={isGenerating}
          >
            Cancel
          </button>
          <button 
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className={`
              flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold shadow-lg transition-all
              ${isGenerating || !prompt.trim() 
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' 
                : isSubtaskMode 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-indigo-200'
              }
            `}
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Thinking...
              </>
            ) : (
              <>
                {isSubtaskMode ? <GitBranchPlus size={16}/> : <Sparkles size={16} />} Generate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
