import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Calendar,
  ChevronRight,
  ChevronDown,
  Plus,
  AlertCircle,
  GanttChartSquare,
  LayoutDashboard,
  Save,
  RotateCcw,
  Loader2,
  Filter,
  ArrowUpDown,
  Link as LinkIcon,
  X,
  Edit2,
  History,
  ArrowLeftFromLine,
  ArrowRightFromLine,
  MousePointerClick,
  GitMerge,
  GitBranchPlus,
  Users,
  Wifi,
  WifiOff,
  Sparkles
} from 'lucide-react';
import { Task, TaskType, TYPE_COLORS, TASK_TYPE_LABELS } from './types';
import { store } from './services/store'; // New collaborative store
import { dbService } from './services/db'; // Keeping for Version Snapshots
import { StatCard } from './components/StatCard';
import { EditTaskModal } from './components/EditTaskModal';
import { VersionControlModal } from './components/VersionControlModal';
import { AIGenerateModal } from './components/AIGenerateModal';
import { useToast } from './context/ToastContext';
import { SettingsModal } from './components/SettingsModal';
import { Settings as SettingsIcon } from 'lucide-react';

// Interface for flat rendering of trees
interface RenderTask extends Task {
  level: number;
  hasChildren: boolean;
}

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [peerCount, setPeerCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<string>('connecting');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);

  // AI Modal States
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [aiModalMode, setAiModalMode] = useState<'plan' | 'subtasks'>('plan');
  const [aiParentTask, setAiParentTask] = useState<Task | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const toast = useToast();

  // Scroll Sync Refs
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef<'left' | 'right' | null>(null);

  // Filter & Sort State
  const [filters, setFilters] = useState({
    type: 'all',
    owner: 'all',
    status: 'all'
  });
  const [sortConfig, setSortConfig] = useState<{ key: keyof Task | 'order', direction: 'asc' | 'desc' }>({
    key: 'order',
    direction: 'asc'
  });

  // Subscribe to Collaborative Store and Init DB
  useEffect(() => {
    // Initialize local DB for snapshots
    dbService.init().catch(e => console.error("Failed to init DB", e));

    // Subscribe to Tasks
    const unsubscribeTasks = store.subscribe((updatedTasks) => {
      // Ensure ordering is respected based on 'order' field if not sorted otherwise
      // We can just set the state, the sorting logic in useMemo will handle display
      setTasks(updatedTasks);
      setIsLoading(false);
    });

    // Subscribe to Awareness (Peer Count & Status)
    const unsubscribeAwareness = store.subscribeAwareness((count, status) => {
      setPeerCount(count);
      setConnectionStatus(status);
    });

    return () => {
      unsubscribeTasks();
      unsubscribeAwareness();
    };
  }, []);

  // Show a toast when connection is established
  useEffect(() => {
    if (connectionStatus === 'connected') {
      // Optional: Less intrusive connection toast, or remove if too noisy
      // toast.success('Connected to Sync Server');
    } else if (connectionStatus === 'disconnected') {
      toast.warning('Disconnected from Sync Server');
    }
  }, [connectionStatus, toast]);

  // Scroll Sync Logic
  const handleScrollLeft = () => {
    if (isScrollingRef.current === 'right') return;
    if (leftPanelRef.current && rightPanelRef.current) {
      isScrollingRef.current = 'left';
      rightPanelRef.current.scrollTop = leftPanelRef.current.scrollTop;
      // Reset after a small timeout to allow other scroll handler to skip
      setTimeout(() => { isScrollingRef.current = null; }, 50);
    }
  };

  const handleScrollRight = () => {
    if (isScrollingRef.current === 'left') return;
    if (leftPanelRef.current && rightPanelRef.current) {
      isScrollingRef.current = 'right';
      leftPanelRef.current.scrollTop = rightPanelRef.current.scrollTop;
      setTimeout(() => { isScrollingRef.current = null; }, 50);
    }
  };

  // Derived State: Processed Tasks (Filtered & Flattened Tree)
  const processedTasks = useMemo<RenderTask[]>(() => {
    let result = [...tasks];

    // 1. Filter
    if (filters.type !== 'all') result = result.filter(t => t.type === filters.type);
    if (filters.owner !== 'all') result = result.filter(t => t.owner === filters.owner);
    if (filters.status !== 'all') result = result.filter(t => t.status === filters.status);

    // 2. Build Tree Structure Logic
    const childrenMap = new Map<number, Task[]>();
    result.forEach(t => {
      if (t.parentId) {
        if (!childrenMap.has(t.parentId)) childrenMap.set(t.parentId, []);
        childrenMap.get(t.parentId)?.push(t);
      }
    });

    // Helper to sort a list of tasks
    const sortFn = (a: Task, b: Task) => {
      let valA: any = a[sortConfig.key as keyof Task];
      let valB: any = b[sortConfig.key as keyof Task];

      if (sortConfig.key === 'order') {
        valA = a.order;
        valB = b.order;
      }
      if (sortConfig.key === 'start' || sortConfig.key === 'end') {
        valA = new Date(valA as string).getTime();
        valB = new Date(valB as string).getTime();
      }
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    };

    // 3. Recursive Flattening
    const flatList: RenderTask[] = [];
    const processLevel = (taskList: Task[], level: number) => {
      taskList.sort(sortFn).forEach(t => {
        const hasChildren = childrenMap.has(t.id);
        flatList.push({ ...t, level, hasChildren });

        // Only recurse if expanded and we found children
        // We treat 'manual order' as strict tree. For other sorts, it usually still makes sense to group children.
        if (hasChildren && t.isExpanded) {
          processLevel(childrenMap.get(t.id)!, level + 1);
        }
      });
    };

    // Find roots (items with no parent OR items whose parent is filtered out)
    const existingIds = new Set(result.map(t => t.id));
    const roots = result.filter(t => !t.parentId || !existingIds.has(t.parentId));

    processLevel(roots, 0);

    return flatList;
  }, [tasks, filters, sortConfig]);

  // Derived State: Date Range (based on ALL tasks to keep timeline stable)
  const dateRange = useMemo(() => {
    if (tasks.length === 0) {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 14);
      const range = [];
      let curr = new Date(start);
      while (curr <= end) {
        range.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
      }
      return range;
    }

    const dates = tasks.flatMap(t => [new Date(t.start), new Date(t.end)]);
    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    const max = new Date(Math.max(...dates.map(d => d.getTime())));

    // Padding
    min.setDate(min.getDate() - 3);
    max.setDate(max.getDate() + 5);

    const range: Date[] = [];
    let curr = new Date(min);
    while (curr <= max) {
      range.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return range;
  }, [tasks]);

  const uniqueOwners = useMemo(() => Array.from(new Set(tasks.map(t => t.owner))), [tasks]);

  const openEditModal = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const openAIModalForPlan = () => {
    setAiModalMode('plan');
    setAiParentTask(null);
    setIsAIModalOpen(true);
  };

  const openAIModalForSubtasks = (task: Task) => {
    setAiModalMode('subtasks');
    setAiParentTask(task);
    setIsAIModalOpen(true);
  };

  const handleTaskClick = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setFocusedTaskId(prev => prev === id ? null : id);
  };

  const handleTaskDoubleClick = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    openEditModal(task);
  };

  const toggleExpand = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    const updated = { ...task, isExpanded: !task.isExpanded };
    store.updateTask(updated);
  };

  const handleSaveTask = (updatedTask: Task) => {
    store.updateTask(updatedTask);
    setIsModalOpen(false);
    setSelectedTask(null);
    toast.success('Task saved successfully');
  };

  const addTask = (parentId?: number) => {
    const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order)) : 0;

    // Intelligent Date Defaulting
    let defaultStart = new Date().toISOString().split('T')[0];
    let defaultEnd = new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];

    if (tasks.length > 0) {
      const refTask = tasks.find(t => t.id === focusedTaskId) || tasks[tasks.length - 1];
      if (refTask) {
        defaultStart = refTask.start;
        defaultEnd = refTask.end;
      }
    }

    const newTask: Task = {
      id: Date.now(),
      name: parentId ? 'New Subtask' : 'New Task',
      start: defaultStart,
      end: defaultEnd,
      type: 'downstream',
      status: 'todo',
      owner: 'TBD',
      dependencies: [],
      order: maxOrder + 1,
      parentId: parentId,
      isExpanded: true
    };

    store.addTask(newTask);

    if (parentId) {
      const parent = tasks.find(t => t.id === parentId);
      if (parent && !parent.isExpanded) store.updateTask({ ...parent, isExpanded: true });
    }

    setFocusedTaskId(newTask.id);
    openEditModal(newTask);
    toast.success('New task created');
  };

  const deleteTask = (id: number) => {
    const idsToDelete = new Set<number>();
    const collect = (taskId: number) => {
      idsToDelete.add(taskId);
      tasks.filter(t => t.parentId === taskId).forEach(child => collect(child.id));
    };
    collect(id);

    // Keeping window.confirm for destructive actions is good UX, 
    // but the final feedback should be a toast.
    if (idsToDelete.size > 1 && !window.confirm(`This will delete the task and its ${idsToDelete.size - 1} subtasks. Continue?`)) {
      return;
    }

    for (const tid of idsToDelete) {
      store.deleteTask(tid);
    }
    if (focusedTaskId && idsToDelete.has(focusedTaskId)) setFocusedTaskId(null);
    toast.success('Task deleted');
  };

  const resetData = () => {
    if (!window.confirm("这将重置所有数据到初始状态，确定吗？")) return;
    store.resetToDefault();
    setFocusedTaskId(null);
    toast.info('Data reset to default state');
  };

  const handleDataRestore = (restoredTasks: Task[]) => {
    store.replaceAllTasks(restoredTasks);
    setFocusedTaskId(null);
    toast.success('Workspace restored successfully');
  };

  const handleAIPlanGenerated = (newTasks: Task[]) => {
    if (aiModalMode === 'plan') {
      store.replaceAllTasks(newTasks);
      setFocusedTaskId(null);
    } else if (aiModalMode === 'subtasks' && aiParentTask) {
      // Process new subtasks: re-ID them to ensure uniqueness and set parent
      const baseId = Date.now();
      const idMap = new Map<number, number>();

      // First pass: Generate new IDs
      newTasks.forEach((t, index) => {
        idMap.set(t.id, baseId + index);
      });

      // Second pass: Update IDs, dependencies, and set parent
      const finalTasks = newTasks.map((t) => ({
        ...t,
        id: idMap.get(t.id)!,
        parentId: aiParentTask.id, // Set the real parent ID
        dependencies: t.dependencies?.map(d => idMap.get(d) || d).filter(d => d !== undefined) // Remap internal dependencies
      }));

      // Add to store
      finalTasks.forEach(t => store.addTask(t));

      // Ensure parent is expanded
      if (!aiParentTask.isExpanded) {
        store.updateTask({ ...aiParentTask, isExpanded: true });
      }
    }
    setFocusedTaskId(null);
  };

  const getDayOffset = (dateStr: string) => {
    const date = new Date(dateStr);
    const start = dateRange[0];
    return Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  };

  const getDuration = (start: string, end: string) => {
    return Math.floor((new Date(end).getTime() - new Date(start).getTime()) / (24 * 60 * 60 * 1000)) + 1;
  };

  // --- Relationships Logic ---
  const relationships = useMemo(() => {
    if (!focusedTaskId) return { predecessors: [], successors: [] };
    const current = tasks.find(t => t.id === focusedTaskId);
    if (!current) return { predecessors: [], successors: [] };

    const predecessors = current.dependencies || [];
    const successors = tasks.filter(t => t.dependencies?.includes(focusedTaskId)).map(t => t.id);
    return { predecessors, successors };
  }, [focusedTaskId, tasks]);

  const CELL_WIDTH = 44;
  const ROW_HEIGHT_CLASS = "h-28";

  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-slate-500 gap-4">
        <Loader2 className="animate-spin w-10 h-10 text-blue-600" />
        <p>正在同步数据...</p>
      </div>
    );
  }

  // Determine actual Status for display
  const isConnected = connectionStatus === 'connected';

  let statusText = "DISCONNECTED";
  let statusColorClass = "text-red-500 bg-red-50 border-red-100";

  if (isConnected) {
    if (peerCount > 1) {
      statusText = "SYNC ACTIVE";
      statusColorClass = "text-green-600 bg-green-50 border-green-100";
    } else {
      statusText = "ONLINE (ALONE)";
      statusColorClass = "text-amber-600 bg-amber-50 border-amber-100";
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <EditTaskModal
        isOpen={isModalOpen}
        task={selectedTask}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTask}
        onDelete={deleteTask}
        allTasks={tasks}
      />

      <VersionControlModal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
        currentTasks={tasks}
        onRestore={handleDataRestore}
      />

      <AIGenerateModal
        isOpen={isAIModalOpen}
        mode={aiModalMode}
        parentTask={aiParentTask}
        onClose={() => setIsAIModalOpen(false)}
        onPlanGenerated={handleAIPlanGenerated}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-30 relative">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2.5 rounded-xl shadow-lg shadow-blue-200">
            <GanttChartSquare className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">MDM Cutover Planner</h1>
            <div className="flex items-center gap-4 mt-0.5">
              <span className={`flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full border ${statusColorClass}`}>
                {isConnected ? <Wifi size={10} strokeWidth={3} /> : <WifiOff size={10} strokeWidth={3} />}
                {statusText}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-500 font-medium" title="Peers connected including yourself">
                <Users size={12} />
                {peerCount} Peer{peerCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={openAIModalForPlan}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white px-3 py-2 rounded-lg transition-all text-sm font-bold shadow-md shadow-indigo-100 hover:shadow-lg"
          >
            <Sparkles size={16} /> AI Plan
          </button>
          <div className="w-px h-8 bg-slate-200 mx-1"></div>
          <button
            onClick={() => setIsVersionModalOpen(true)}
            className="flex items-center gap-2 text-slate-600 hover:text-blue-600 hover:bg-slate-100 px-3 py-2 rounded-lg transition-all text-sm font-bold border border-transparent hover:border-slate-200"
            title="Version History & Export"
          >
            <History size={18} /> History
          </button>
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="flex items-center gap-2 text-slate-600 hover:text-blue-600 hover:bg-slate-100 px-3 py-2 rounded-lg transition-all text-sm font-bold border border-transparent hover:border-slate-200"
            title="AI Config & Settings"
          >
            <SettingsIcon size={18} /> Settings
          </button>
          <button
            onClick={resetData}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-3 py-2 rounded-lg transition-all text-sm font-medium"
            title="Reset to default data"
          >
            <RotateCcw size={16} /> Reset
          </button>
          <button
            onClick={() => addTask()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-2 rounded-lg transition-all text-sm font-bold shadow-md shadow-blue-200 hover:shadow-lg"
          >
            <Plus size={18} strokeWidth={2.5} /> New Task
          </button>
        </div>
      </header>

      <main
        className="flex-1 flex flex-col overflow-hidden p-6 gap-4 relative"
        onClick={() => setFocusedTaskId(null)}
      >
        {/* Top Controls: Stats & Filters */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-end md:items-center">
          {/* Simple Stats for Context */}
          <div
            className="flex gap-4 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm whitespace-nowrap">
              <Calendar size={16} className="text-blue-500" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Total Duration</div>
                <div className="text-sm font-bold text-slate-700">49 Days</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm whitespace-nowrap">
              <AlertCircle size={16} className="text-amber-500" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Milestones</div>
                <div className="text-sm font-bold text-slate-700">{tasks.filter(t => t.type === 'milestone').length} Events</div>
              </div>
            </div>
          </div>

          {/* Filter & Sort Bar */}
          <div
            className="flex gap-3 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm items-center w-full md:w-auto overflow-x-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-2 border-r border-slate-100">
              <Filter size={14} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-600 hidden sm:inline">Filter</span>
            </div>

            <select
              className="bg-slate-50 border-transparent text-xs font-medium rounded-md px-2 py-1.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none w-28"
              value={filters.type}
              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
            >
              <option value="all">All Types</option>
              {Object.entries(TASK_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>

            <select
              className="bg-slate-50 border-transparent text-xs font-medium rounded-md px-2 py-1.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none w-28"
              value={filters.owner}
              onChange={(e) => setFilters(prev => ({ ...prev, owner: e.target.value }))}
            >
              <option value="all">All Owners</option>
              {uniqueOwners.map(o => <option key={o} value={o}>{o}</option>)}
            </select>

            <select
              className="bg-slate-50 border-transparent text-xs font-medium rounded-md px-2 py-1.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none w-24"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="all">All Status</option>
              <option value="todo">Todo</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Done</option>
            </select>

            <div className="w-px h-6 bg-slate-100 mx-1"></div>

            <div className="flex items-center gap-2 px-2">
              <ArrowUpDown size={14} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-600 hidden sm:inline">Sort</span>
            </div>

            <select
              className="bg-slate-50 border-transparent text-xs font-medium rounded-md px-2 py-1.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none w-28"
              value={sortConfig.key}
              onChange={(e) => setSortConfig(prev => ({ ...prev, key: e.target.value as keyof Task | 'order' }))}
            >
              <option value="order">Manual Order</option>
              <option value="start">Start Date</option>
              <option value="end">End Date</option>
              <option value="name">Name</option>
            </select>

            <button
              onClick={() => setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }))}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-500"
              title="Toggle Sort Direction"
            >
              {sortConfig.direction === 'asc' ? "ASC" : "DESC"}
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex gap-6 overflow-hidden">
          {/* Table Side */}
          <div className="w-1/3 min-w-[400px] bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col z-20">
            <div className="px-5 py-4 border-b border-slate-100 bg-white flex justify-between items-center sticky top-0 z-10 h-16">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <LayoutDashboard size={18} className="text-slate-400" /> 任务清单
              </h3>
              <span className="text-xs text-slate-400 font-mono">{processedTasks.length} visible</span>
            </div>

            <div
              ref={leftPanelRef}
              onScroll={handleScrollLeft}
              className="flex-1 overflow-y-auto custom-scrollbar"
            >
              {/* Spacer to align with Right Side Calendar Header (h-12 = 48px) */}
              <div className="h-12 border-b border-slate-100 bg-slate-50/50 flex items-center px-4 text-xs font-bold text-slate-400 sticky top-0 z-20 backdrop-blur-sm">
                TASK DETAILS
              </div>

              {processedTasks.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-sm">
                  <p>没有符合条件的任务</p>
                  <button onClick={() => setFilters({ type: 'all', owner: 'all', status: 'all' })} className="text-blue-500 hover:underline mt-2">清除筛选</button>
                </div>
              ) : processedTasks.map(task => {
                const isFocused = focusedTaskId === task.id;
                const isPredecessor = relationships.predecessors.includes(task.id);
                const isSuccessor = relationships.successors.includes(task.id);

                let highlightClass = "";
                if (focusedTaskId) {
                  if (isFocused) highlightClass = "bg-blue-50 ring-2 ring-inset ring-blue-500";
                  else if (isPredecessor) highlightClass = "bg-amber-50 ring-2 ring-inset ring-amber-400";
                  else if (isSuccessor) highlightClass = "bg-green-50 ring-2 ring-inset ring-green-400";
                  else highlightClass = "opacity-50 grayscale";
                }

                return (
                  <div
                    key={task.id}
                    className={`group relative p-3 border-b border-slate-50 hover:bg-slate-50 transition-all cursor-pointer ${ROW_HEIGHT_CLASS} ${highlightClass}`}
                    onClick={(e) => handleTaskClick(e, task.id)}
                    onDoubleClick={(e) => handleTaskDoubleClick(e, task)}
                  >
                    {/* Status Indicator Bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${TYPE_COLORS[task.type].split(' ')[0]}`}></div>

                    {/* Indentation logic */}
                    <div className="flex gap-2 h-full flex-col justify-center" style={{ paddingLeft: `${task.level * 16}px` }}>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex justify-between items-center mb-1 gap-2">
                          <div className="flex items-center gap-2 w-full">
                            {task.hasChildren ? (
                              <button
                                onClick={(e) => toggleExpand(e, task)}
                                className="p-0.5 rounded hover:bg-slate-200 text-slate-400"
                              >
                                {task.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            ) : (
                              <span className="w-4"></span>
                            )}
                            <span className="text-[10px] font-mono text-slate-300 min-w-[1.5rem]">#{task.id}</span>
                            <span className={`font-semibold text-sm truncate ${task.hasChildren ? 'text-slate-800' : 'text-slate-700'}`}>{task.name}</span>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="AI Subtasks"
                              onClick={(e) => { e.stopPropagation(); openAIModalForSubtasks(task); }}
                            >
                              <Sparkles size={14} />
                            </button>
                            <button
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="Add Subtask"
                              onClick={(e) => { e.stopPropagation(); addTask(task.id); }}
                            >
                              <GitBranchPlus size={14} />
                            </button>
                            <button
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              onClick={(e) => { e.stopPropagation(); openEditModal(task); }}
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs text-slate-500 pl-6 mb-1">
                          <div className="flex gap-1 items-center">
                            <span className="text-[10px] uppercase font-bold text-slate-300">Start</span>
                            <span className="font-mono text-slate-600">{task.start}</span>
                          </div>
                          <div className="flex gap-1 items-center">
                            <span className="text-[10px] uppercase font-bold text-slate-300">End</span>
                            <span className="font-mono text-slate-600">{task.end}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center gap-2 pl-6">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${TYPE_COLORS[task.type].split(' ')[0]}`}>
                              {TASK_TYPE_LABELS[task.type]}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {task.dependencies && task.dependencies.length > 0 && (
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                <LinkIcon size={10} />
                                {task.dependencies.length}
                              </div>
                            )}
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded truncate max-w-[60px]">
                              {task.owner}
                            </span>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${task.status === 'done' ? 'bg-green-50 text-green-600 border-green-200' :
                                task.status === 'in-progress' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                  'bg-slate-50 text-slate-500 border-slate-200'
                              }`}>
                              {task.status === 'todo' ? 'To Do' : task.status === 'in-progress' ? 'Doing' : 'Done'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Gantt Side */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative z-10">
            <div className="px-5 py-4 border-b border-slate-100 bg-white sticky top-0 z-20 flex justify-between items-center h-16">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <GanttChartSquare size={18} className="text-slate-400" /> 可视化时间轴
              </h3>
              <div className="flex gap-2">
                {Object.entries(TASK_TYPE_LABELS).map(([type, label]) => (
                  <div key={type} className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${TYPE_COLORS[type as TaskType].split(' ')[0]}`}></div>
                    <span className="text-[10px] text-slate-400">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              ref={rightPanelRef}
              onScroll={handleScrollRight}
              className="flex-1 overflow-x-auto overflow-y-auto relative custom-scrollbar bg-slate-50/30"
            >
              <div className="inline-flex h-full min-w-full">
                <div className="relative h-fit pb-10">
                  {/* Calendar Header (Sticky within scroll area) */}
                  <div className="flex sticky top-0 z-10 bg-white shadow-sm border-b border-slate-200 h-12">
                    {dateRange.map((date, idx) => {
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      const todayStr = new Date().toDateString();
                      const isToday = date.toDateString() === todayStr;

                      return (
                        <div key={idx} className={`w-11 h-full flex-shrink-0 flex flex-col items-center justify-center border-r border-slate-100 ${isWeekend ? 'bg-slate-50/50' : ''} ${isToday ? 'bg-amber-50' : ''}`}>
                          <div className={`text-[10px] font-medium mb-0.5 ${isWeekend ? 'text-red-300' : 'text-slate-400'}`}>
                            {['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}
                          </div>
                          <div className={`text-xs font-bold leading-none ${isToday ? 'text-amber-600' : 'text-slate-600'}`}>
                            {date.getDate()}
                          </div>
                          {date.getDate() === 1 && (
                            <div className="absolute top-0 left-1 text-[9px] font-bold text-slate-300">{date.getMonth() + 1}月</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Task Bars Area */}
                  <div className="relative px-0">
                    {/* Background Grid */}
                    <div className="absolute inset-0 flex pointer-events-none z-0">
                      {dateRange.map((_, i) => (
                        <div key={i} className="w-11 h-full border-r border-slate-100 border-dashed flex-shrink-0 last:border-0" />
                      ))}
                    </div>

                    {processedTasks.map((task) => {
                      const offset = getDayOffset(task.start);
                      const duration = getDuration(task.start, task.end);
                      const isMilestone = task.type === 'milestone';
                      const width = Math.max(1, isMilestone ? 1 : duration);

                      const isFocused = focusedTaskId === task.id;
                      const isPredecessor = relationships.predecessors.includes(task.id);
                      const isSuccessor = relationships.successors.includes(task.id);

                      let barClass = `opacity-90 hover:opacity-100`;

                      if (focusedTaskId) {
                        if (isFocused) {
                          barClass = "opacity-100 z-30 shadow-xl scale-[1.02] ring-2 ring-blue-500 ring-offset-2";
                        } else if (isPredecessor) {
                          barClass = "opacity-100 z-20 shadow-lg ring-2 ring-amber-400 ring-offset-1";
                        } else if (isSuccessor) {
                          barClass = "opacity-100 z-20 shadow-lg ring-2 ring-green-400 ring-offset-1";
                        } else {
                          barClass = "opacity-30 grayscale";
                        }
                      }

                      return (
                        <div key={task.id} className={`flex items-center relative z-1 group border-b border-transparent ${ROW_HEIGHT_CLASS}`}>
                          <div
                            className={`
                                absolute h-6 rounded shadow-sm border-b-2 flex items-center px-2 text-white text-[11px] font-medium whitespace-nowrap overflow-hidden 
                                transition-all duration-200 cursor-pointer
                                ${TYPE_COLORS[task.type]}
                                ${barClass}
                            `}
                            onClick={(e) => handleTaskClick(e, task.id)}
                            onDoubleClick={(e) => handleTaskDoubleClick(e, task)}
                            style={{
                              left: `${offset * CELL_WIDTH}px`,
                              width: `${width * CELL_WIDTH}px`,
                              borderRadius: isMilestone ? '9999px' : '4px',
                              transform: isMilestone ? 'scale(0.7) rotate(45deg)' : 'none',
                              justifyContent: isMilestone ? 'center' : 'flex-start'
                            }}
                          >
                            {!isMilestone && (
                              <div className="flex items-center gap-1 w-full">
                                <span className="font-mono opacity-60 text-[9px] mr-0.5">#{task.id}</span>
                                <span className="truncate">{task.name}</span>

                                {/* Subtask / Parent Indicator */}
                                {task.hasChildren && <GitMerge size={10} className="ml-1 opacity-70" />}

                                {/* Dependency Tags on Bar */}
                                {task.dependencies && task.dependencies.length > 0 && !isMilestone && (
                                  <div className="flex gap-0.5 ml-auto">
                                    {task.dependencies.map(depId => (
                                      <span key={depId} className="text-[8px] bg-black/20 px-1 rounded-sm font-mono">
                                        #{depId}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {isMilestone && (
                              <span className="-rotate-45 text-lg">★</span>
                            )}

                            {/* Relationship Badges when Focused */}
                            {isPredecessor && !isMilestone && (
                              <div className="absolute -right-2 -top-2 bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded-full shadow-sm z-40 animate-in zoom-in">
                                Pre
                              </div>
                            )}
                            {isSuccessor && !isMilestone && (
                              <div className="absolute -right-2 -top-2 bg-green-500 text-white text-[9px] px-1.5 py-0.5 rounded-full shadow-sm z-40 animate-in zoom-in">
                                Post
                              </div>
                            )}
                          </div>

                          {/* Tooltip */}
                          <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow-xl z-50 pointer-events-none transition-opacity whitespace-nowrap"
                            style={{ left: `${(offset * CELL_WIDTH) + 10}px` }}>
                            #{task.id} {task.name} ({task.start} ~ {task.end})
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span>MDM System Cutover Plan © 2025</span>
          <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-slate-500">
            <MousePointerClick size={12} /> Click to Highlight
          </span>
          <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-slate-500">
            Double Click to Edit
          </span>
        </div>
        <div className="flex gap-4">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Predecessor</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400"></span> Successor</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Selected</span>
        </div>
      </footer>
    </div >
  );
};

export default App;