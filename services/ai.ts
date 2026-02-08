import { GoogleGenAI, Type } from "@google/genai";
import { Task, AISettings } from "../types";
import { settingsService } from "./settings";

const SYSTEM_INSTRUCTION_BASE = `You are an expert Senior Project Manager. 
Your goal is to create a detailed, realistic project plan (Gantt chart) based on the user's description.

CRITICAL RULES:
1. Dates ('start', 'end') MUST be in strict 'YYYY-MM-DD' format.
2. 'type' must be one of: 'prep', 'cutover', 'upstream', 'downstream', 'milestone'.
3. 'status' must be 'todo'.
4. 'id' should be a unique integer starting from 1.
5. 'dependencies' should be an array of IDs (integers) referencing other tasks in this list.
6. 'order' should be the index + 1.
7. 'isExpanded' should be true.

Output ONLY a JSON array of tasks matching the schema.`;

const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.INTEGER },
      name: { type: Type.STRING },
      start: { type: Type.STRING, description: "YYYY-MM-DD format" },
      end: { type: Type.STRING, description: "YYYY-MM-DD format" },
      type: { type: Type.STRING, enum: ['prep', 'cutover', 'upstream', 'downstream', 'milestone'] },
      status: { type: Type.STRING, enum: ['todo', 'in-progress', 'done'] },
      owner: { type: Type.STRING },
      dependencies: { type: Type.ARRAY, items: { type: Type.INTEGER } },
      order: { type: Type.INTEGER },
      parentId: { type: Type.INTEGER, nullable: true },
      isExpanded: { type: Type.BOOLEAN },
    },
    required: ["id", "name", "start", "end", "type", "status", "owner", "order", "isExpanded"],
  },
};

export const generateProjectPlan = async (description: string): Promise<Task[]> => {
  const settings = settingsService.getSettings();
  const today = new Date();
  const localDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  const systemInstruction = `${SYSTEM_INSTRUCTION_BASE}
  Current Reference Date: ${localDate} (YYYY-MM-DD).
  If the user says "starting next Monday", calculate the date relative to ${localDate}.`;

  if (settings.provider === 'gemini') {
    return callGemini(description, systemInstruction, settings);
  } else {
    return callQwen(description, systemInstruction, settings);
  }
};

export const generateSubtasks = async (parentTask: Task, description: string): Promise<Task[]> => {
  const settings = settingsService.getSettings();
  const systemInstruction = `${SYSTEM_INSTRUCTION_BASE}
  
  CONTEXT:
  You are generating SUBTASKS for a parent task named "${parentTask.name}".
  The parent task is scheduled from ${parentTask.start} to ${parentTask.end}.
  
  IMPORTANT:
  - Ensure the generated subtasks fall within or very close to the parent's date range (${parentTask.start} to ${parentTask.end}).
  - Do not set 'parentId' in the JSON (it will be handled by the application).
  - Provide a logical breakdown of the work described.`;

  if (settings.provider === 'gemini') {
    return callGemini(description, systemInstruction, settings);
  } else {
    return callQwen(description, systemInstruction, settings);
  }
};

const callGemini = async (contents: string, systemInstruction: string, settings: AISettings): Promise<Task[]> => {
  const apiKey = settings.geminiApiKey || process.env.API_KEY || '';
  if (!apiKey) throw new Error("Missing Gemini API Key. Please configure it in Settings.");

  const ai = new GoogleGenAI({ apiKey });

  // Using the original SDK style found in the project
  const response = await (ai as any).models.generateContent({
    model: settings.modelName || 'gemini-1.5-flash',
    contents: contents,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    }
  });

  if (!response.text) throw new Error("No response from Gemini");
  return parseTasks(response.text);
};

const callQwen = async (contents: string, systemInstruction: string, settings: AISettings): Promise<Task[]> => {
  const apiKey = settings.qwenApiKey;
  if (!apiKey) throw new Error("Missing Qwen API Key. Please configure it in Settings.");

  let endpoint = settings.qwenEndpoint || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

  // Transparent CORS Proxy for development
  if (endpoint.includes('aigateway.aliyun.pwccn.com.cn')) {
    endpoint = endpoint.replace('https://aigateway.aliyun.pwccn.com.cn', '/qwen-api');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: settings.modelName || 'qwen3-32b',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: contents }
      ],
      response_format: { type: "json_object" },
      // Required by some Aliyun gateway configurations for non-streaming calls
      enable_thinking: false
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Qwen API Error: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const text = data.choices[0].message.content;

  // Qwen sometimes wraps the array in an object if forced to json_object
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parseTasks(text);
    if (parsed.tasks && Array.isArray(parsed.tasks)) return parseTasks(JSON.stringify(parsed.tasks));
    // Try to find the first array in the object
    const firstArray = Object.values(parsed).find(v => Array.isArray(v));
    if (firstArray) return parseTasks(JSON.stringify(firstArray));
    return parseTasks(text);
  } catch (e) {
    return parseTasks(text);
  }
};

const parseTasks = (text: string): Task[] => {
  try {
    const tasks = JSON.parse(text) as Task[];
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const today = new Date();
    const fallbackDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    return tasks.map(t => ({
      ...t,
      start: dateRegex.test(t.start) ? t.start : fallbackDate,
      end: dateRegex.test(t.end) ? t.end : fallbackDate,
      dependencies: t.dependencies || []
    }));
  } catch (e) {
    console.error("Failed to parse AI response", e);
    throw new Error("Failed to parse AI plan");
  }
};
