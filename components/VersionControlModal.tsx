import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Download, Upload, Clock, Trash2, RotateCcw, FileJson, Users, Globe, FileSpreadsheet } from 'lucide-react';
import { Task, TaskVersion } from '../types';
import { store } from '../services/store';
import { useToast } from '../context/ToastContext';
import * as XLSX from 'xlsx';

interface VersionControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTasks: Task[];
  onRestore: (tasks: Task[]) => void;
}

export const VersionControlModal: React.FC<VersionControlModalProps> = ({
  isOpen,
  onClose,
  currentTasks,
  onRestore
}) => {
  const [versions, setVersions] = useState<TaskVersion[]>([]);
  const [newVersionName, setNewVersionName] = useState('');
  const [activeTab, setActiveTab] = useState<'snapshots' | 'io'>('snapshots');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      // Subscribe to shared versions from Yjs store
      const unsubscribe = store.subscribeVersions((sharedVersions) => {
          setVersions(sharedVersions);
      });
      
      setNewVersionName(`Snapshot ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
      
      return () => {
          unsubscribe();
      };
    }
  }, [isOpen]);

  const handleSaveSnapshot = () => {
    if (!newVersionName.trim()) return;
    try {
      store.addVersion(newVersionName, currentTasks);
      setNewVersionName(`Snapshot ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
      toast.success('Snapshot saved successfully');
    } catch (e) {
      console.error("Failed to save snapshot", e);
      toast.error('Failed to save snapshot');
    }
  };

  const handleRestore = (version: TaskVersion) => {
    if (window.confirm(`Restore "${version.name}"? This will overwrite the current shared workspace for ALL users.`)) {
      onRestore(version.tasks);
      onClose();
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Delete this shared snapshot?")) {
      store.deleteVersion(id);
      toast.info('Snapshot deleted');
    }
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(currentTasks, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mdm-cutover-tasks-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Data exported to JSON');
  };

  const handleExportExcel = () => {
    try {
        // 1. Flatten data for Excel
        const excelData = currentTasks.map(t => ({
            ID: t.id,
            Name: t.name,
            Start: t.start,
            End: t.end,
            Type: t.type,
            Status: t.status,
            Owner: t.owner,
            ParentID: t.parentId || '',
            Dependencies: t.dependencies?.join(', ') || ''
        }));

        // 2. Create worksheet
        const ws = XLSX.utils.json_to_sheet(excelData);
        
        // 3. Set column widths
        const wscols = [
            { wch: 10 }, // ID
            { wch: 40 }, // Name
            { wch: 12 }, // Start
            { wch: 12 }, // End
            { wch: 12 }, // Type
            { wch: 10 }, // Status
            { wch: 15 }, // Owner
            { wch: 10 }, // ParentID
            { wch: 15 }, // Dependencies
        ];
        ws['!cols'] = wscols;

        // 4. Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Cutover Plan");

        // 5. Download
        XLSX.writeFile(wb, `mdm-cutover-plan-${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('Excel file exported');
    } catch (e) {
        console.error(e);
        toast.error('Failed to export Excel');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json) && json.length > 0 && json[0].id && json[0].name) {
           if(window.confirm(`Importing ${json.length} tasks. This will overwrite current data for ALL users. Continue?`)) {
               onRestore(json);
               onClose();
           }
        } else {
            toast.error("Invalid JSON format: Expected an array of tasks.");
        }
      } catch (err) {
        toast.error("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Clock size={20} className="text-blue-600"/> History & Sync
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
            <button 
                className={`flex-1 py-3 text-sm font-medium ${activeTab === 'snapshots' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setActiveTab('snapshots')}
            >
                Shared Snapshots
            </button>
            <button 
                className={`flex-1 py-3 text-sm font-medium ${activeTab === 'io' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setActiveTab('io')}
            >
                Import / Export
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/30">
            {activeTab === 'snapshots' && (
                <div className="space-y-6">
                    {/* Create New */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase">Create Shared Snapshot</label>
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                <Globe size={10} /> Syncs to everyone
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <input 
                                value={newVersionName}
                                onChange={(e) => setNewVersionName(e.target.value)}
                                placeholder="Snapshot Name..."
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                            />
                            <button 
                                onClick={handleSaveSnapshot}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                            >
                                <Save size={16} /> Save
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="space-y-3">
                        <label className="block text-xs font-bold text-slate-400 uppercase">Shared History</label>
                        {versions.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-sm italic">No shared snapshots yet.</div>
                        ) : (
                            versions.map(v => (
                                <div key={v.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center group hover:border-blue-200 transition-colors">
                                    <div>
                                        <div className="font-bold text-slate-700 text-sm">{v.name}</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                            {new Date(v.createdAt).toLocaleString()} 
                                            <span className="text-slate-300">•</span>
                                            {v.tasks.length} tasks
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => handleRestore(v)}
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                            title="Restore this version to everyone"
                                        >
                                            <RotateCcw size={16} />
                                        </button>
                                        <button 
                                            onClick={() => v.id && handleDelete(v.id as number)}
                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                            title="Delete shared snapshot"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'io' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4">
                        {/* Excel Export Card */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-green-300 transition-colors group">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
                                    <FileSpreadsheet size={20} className="text-green-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-700 text-sm">Export to Excel</h3>
                                    <p className="text-xs text-slate-400">Download formatted plan as .xlsx</p>
                                </div>
                            </div>
                            <button 
                                onClick={handleExportExcel}
                                className="px-4 py-2 rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 text-sm font-bold transition-colors"
                            >
                                Download
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center gap-3 hover:border-blue-300 transition-colors group">
                            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                <Download size={24} className="text-blue-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-700">Export JSON</h3>
                                <p className="text-xs text-slate-400 mt-1">Full data backup</p>
                            </div>
                            <button 
                                onClick={handleExportJSON}
                                className="mt-2 w-full py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-bold"
                            >
                                Download
                            </button>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center gap-3 hover:border-indigo-300 transition-colors group">
                             <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                                <Upload size={24} className="text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-700">Import JSON</h3>
                                <p className="text-xs text-slate-400 mt-1">Restore from backup</p>
                            </div>
                            <button 
                                onClick={handleImportClick}
                                className="mt-2 w-full py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-bold"
                            >
                                Select File
                            </button>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept=".json" 
                                onChange={handleFileChange}
                            />
                        </div>
                    </div>

                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-800 text-xs leading-relaxed">
                        <strong className="block mb-1 font-bold">Warning:</strong>
                        Importing a file or restoring a snapshot will replace the workspace data for <u>all connected users</u> instantly. Use with caution.
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
