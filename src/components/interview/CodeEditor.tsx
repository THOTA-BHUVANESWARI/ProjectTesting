import { useEffect, useState, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { supabase } from '@/integrations/supabase/client';
import { CodeSession } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, RotateCcw, Copy, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

import { cn } from '@/lib/utils';

declare global {
  interface Window {
    loadPyodide: any;
  }
}
const loadPyodideScript = () => {
  return new Promise<void>((resolve, reject) => {
    if ((window as any).loadPyodide) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Pyodide"));
    document.body.appendChild(script);
  });
};

interface CodeEditorProps {
  interviewId: string;
  readOnly?: boolean;
}

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'typescript', label: 'TypeScript' },
];

const DEFAULT_CODE: Record<string, string> = {
  javascript: `function solution(input) {
  return input.reduce((a, b) => a + b, 0);
}

console.log(solution([1, 2, 3]));`,
  python: `def solution(input):
    return sum(input)

print(solution([1, 2, 3]))`,
  java: `public class Solution {
    public static void main(String[] args) {
        System.out.println(solution(new int[]{1,2,3}));
    }
    public static int solution(int[] input) {
        int sum = 0;
        for(int n : input) sum += n;
        return sum;
    }
}`,
  typescript: `function solution(input: number[]): number {
  return input.reduce((a, b) => a + b, 0);
}

console.log(solution([1, 2, 3]));`,
};

export function CodeEditor({ interviewId, readOnly = false }: CodeEditorProps) {
  const [codeSession, setCodeSession] = useState<CodeSession | null>(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const pyodideRef = useRef<any>(null);

  useEffect(() => {
    fetchOrCreateSession();
  }, [interviewId]);

  const fetchOrCreateSession = async () => {
    try {
      const { data: existing } = await supabase
        .from('code_sessions')
        .select('*')
        .eq('interview_id', interviewId)
        .single();

      if (existing) {
        setCodeSession(existing as CodeSession);
        setCode(existing.code_content);
        setLanguage(existing.language);
        return;
      }

      const { data: newSession } = await supabase
        .from('code_sessions')
        .insert({
          interview_id: interviewId,
          language: 'javascript',
          code_content: DEFAULT_CODE.javascript,
        })
        .select()
        .single();

      setCodeSession(newSession as CodeSession);
      setCode(newSession.code_content);
      setLanguage(newSession.language);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCodeChange = useCallback(
    async (value: string | undefined) => {
      if (!value || !codeSession || readOnly) return;

      setCode(value);

      const updateTime = new Date().toISOString();
      setLastUpdate(updateTime);

      await supabase
        .from('code_sessions')
        .update({
          code_content: value,
          updated_at: updateTime,
        })
        .eq('id', codeSession.id);
    },
    [codeSession, readOnly]
  );

  const handleRun = async () => {
    setIsRunning(true);
    setOutput('Running...\n');

    try {
      // ✅ JavaScript
      if (language === 'javascript') {
        const logs: string[] = [];
        const mockConsole = {
          log: (...args: unknown[]) =>
            logs.push(args.map(String).join(' ')),
        };

        const fn = new Function('console', code);
        fn(mockConsole);

        setOutput(logs.join('\n') || 'Code executed successfully');
      }

      // ✅ Python
     else if (language === "python") {
  await loadPyodideScript();

  // 🔥 Wait until loadPyodide is actually available
  while (!(window as any).loadPyodide) {
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!pyodideRef.current) {
    pyodideRef.current = await (window as any).loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/",
    });
  }

  let outputBuffer = "";

  pyodideRef.current.setStdout({
    batched: (text: string) => {
      outputBuffer += text;
    },
  });

  await pyodideRef.current.runPythonAsync(code);

  setOutput(outputBuffer || "Code executed successfully");
}
      // ❌ Others
      else {
        setOutput(`${language.toUpperCase()} execution not supported in browser.`);
      }
    } catch (err) {
      setOutput(`Error: ${(err as Error).message}`);
    }

    setIsRunning(false);
  };

  const handleReset = () => {
    setCode(DEFAULT_CODE[language] || '');
    setOutput('');
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast({ title: 'Code copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-editor-bg rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/20">
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang.value} value={lang.value}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button size="sm" onClick={handleCopy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </Button>
          <Button size="sm" onClick={handleReset}>
            <RotateCcw size={16} />
          </Button>
          <Button size="sm" onClick={handleRun} disabled={isRunning}>
            <Play size={16} /> Run
          </Button>
        </div>
      </div>

      <div className="flex-1">
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={handleCodeChange}
          theme="vs-dark"
          options={{ readOnly }}
        />
      </div>

      <div className="h-32 border-t">
        <div className="px-4 py-2 text-xs">Output</div>
        <pre className="p-4 overflow-auto text-sm font-mono text-green-400">
          {output || 'Click "Run" to execute your code'}
        </pre>
      </div>
    </div>
  );
}