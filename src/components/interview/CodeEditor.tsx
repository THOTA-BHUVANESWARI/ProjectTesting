import { useEffect, useState, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { supabase } from '@/integrations/supabase/client';
import { CodeSession } from '@/types/database';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Play, RotateCcw, Copy, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

declare global {
  interface Window {
    loadPyodide: any;
  }
}

const loadPyodideScript = () =>
  new Promise<void>((resolve, reject) => {
    if ((window as any).loadPyodide) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Pyodide'));
    document.body.appendChild(script);
  });

interface CodeEditorProps {
  interviewId: string;
  readOnly?: boolean;
}

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python',     label: 'Python'     },
  { value: 'java',       label: 'Java'       },
];

const DEFAULT_CODE: Record<string, string> = {
  javascript: `function solution(input) {
  return input.reduce((a, b) => a + b, 0);
}

console.log(solution([1, 2, 3]));`,

  typescript: `function solution(input: number[]): number {
  return input.reduce((a, b) => a + b, 0);
}

console.log(solution([1, 2, 3]));`,

  python: `def solution(input_list):
    return sum(input_list)

print(solution([1, 2, 3]))`,

  java: `public class Solution {
    public static void main(String[] args) {
        System.out.println(solution(new int[]{1, 2, 3}));
    }
    public static int solution(int[] input) {
        int sum = 0;
        for (int n : input) sum += n;
        return sum;
    }
}`,
};

// ── Mock console that captures all output ───────────────────────────────────
function makeMockConsole(logs: string[]) {
  const fmt = (...args: unknown[]) =>
    args
      .map((a) =>
        a === null
          ? 'null'
          : a === undefined
          ? 'undefined'
          : typeof a === 'object'
          ? JSON.stringify(a, null, 2)
          : String(a)
      )
      .join(' ');

  return {
    log:   (...args: unknown[]) => logs.push(fmt(...args)),
    info:  (...args: unknown[]) => logs.push('ℹ ' + fmt(...args)),
    warn:  (...args: unknown[]) => logs.push('⚠ ' + fmt(...args)),
    error: (...args: unknown[]) => logs.push('✖ ' + fmt(...args)),
    table: (data: unknown)      => logs.push(JSON.stringify(data, null, 2)),
    dir:   (data: unknown)      => logs.push(JSON.stringify(data, null, 2)),
  };
}

export function CodeEditor({ interviewId, readOnly = false }: CodeEditorProps) {
  const [codeSession, setCodeSession] = useState<CodeSession | null>(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const pyodideRef = useRef<any>(null);

  // ── Fetch or create session ────────────────────────────────────────────────
  useEffect(() => {
    fetchOrCreateSession();
  }, [interviewId]);

  const fetchOrCreateSession = async () => {
    try {
      const { data: existing } = await supabase
        .from('code_sessions')
        .select('*')
        .eq('interview_id', interviewId)
        .maybeSingle();

      if (existing) {
        setCodeSession(existing as CodeSession);
        setCode(existing.code_content);
        setLanguage(existing.language);
        return;
      }

      const { data: newSession, error } = await supabase
        .from('code_sessions')
        .insert({
          interview_id: interviewId,
          language: 'javascript',
          code_content: DEFAULT_CODE.javascript,
        })
        .select()
        .single();

      if (error) throw error;
      setCodeSession(newSession as CodeSession);
      setCode(newSession.code_content);
      setLanguage(newSession.language);
    } catch (err) {
      console.error('Error fetching code session:', err);
      // Fall back to local state so editor is still usable
      setCode(DEFAULT_CODE.javascript);
      setLanguage('javascript');
    }
  };

  // ── Sync code changes to DB (debounced via Supabase) ──────────────────────
  const handleCodeChange = useCallback(
    async (value: string | undefined) => {
      if (value === undefined || !codeSession || readOnly) return;
      setCode(value);
      await supabase
        .from('code_sessions')
        .update({ code_content: value, updated_at: new Date().toISOString() })
        .eq('id', codeSession.id);
    },
    [codeSession, readOnly]
  );

  // ── Language change ───────────────────────────────────────────────────────
  const handleLanguageChange = async (lang: string) => {
    setLanguage(lang);
    const newCode = DEFAULT_CODE[lang] ?? '';
    setCode(newCode);
    setOutput('');
    if (codeSession) {
      await supabase
        .from('code_sessions')
        .update({ language: lang, code_content: newCode })
        .eq('id', codeSession.id);
    }
  };

  // ── Run code ──────────────────────────────────────────────────────────────
  const handleRun = async () => {
    setIsRunning(true);
    setOutput('Running…\n');

    try {
      // ── JavaScript ──────────────────────────────────────────────────────
      if (language === 'javascript') {
        const logs: string[] = [];
        const mockConsole = makeMockConsole(logs);
        try {
          // eslint-disable-next-line no-new-func
          const fn = new Function('console', code);
          fn(mockConsole);
        } catch (err) {
          logs.push(`✖ ${(err as Error).message}`);
        }
        setOutput(logs.length > 0 ? logs.join('\n') : 'Code executed with no output');
      }

      // ── TypeScript (strip type annotations, run as JS) ───────────────────
      else if (language === 'typescript') {
        const logs: string[] = [];
        const mockConsole = makeMockConsole(logs);
        // Basic type stripping — handles most interview-style TS
        const jsCode = code
          .replace(/:\s*(number|string|boolean|void|any|never|unknown|null|undefined)(\[\])*/g, '')
          .replace(/:\s*\w+(\[\])*/g, '')
          .replace(/<[^>()]+>/g, '')
          .replace(/interface\s+\w+\s*\{[^}]*\}/gs, '')
          .replace(/type\s+\w+\s*=\s*[^;]+;/g, '');
        try {
          // eslint-disable-next-line no-new-func
          const fn = new Function('console', jsCode);
          fn(mockConsole);
        } catch (err) {
          logs.push(`✖ ${(err as Error).message}`);
        }
        setOutput(logs.length > 0 ? logs.join('\n') : 'Code executed with no output');
      }

      // ── Python (via Pyodide) ─────────────────────────────────────────────
      else if (language === 'python') {
        await loadPyodideScript();

        // Wait for loadPyodide to become available
        let attempts = 0;
        while (!(window as any).loadPyodide && attempts < 50) {
          await new Promise((r) => setTimeout(r, 200));
          attempts++;
        }

        if (!(window as any).loadPyodide) {
          setOutput('✖ Could not load Python runtime. Check your connection.');
          return;
        }

        if (!pyodideRef.current) {
          setOutput('Loading Python runtime (first run takes ~5s)…');
          pyodideRef.current = await (window as any).loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/',
          });
        }

        let outputBuffer = '';
        pyodideRef.current.setStdout({
          batched: (text: string) => { outputBuffer += text + '\n'; },
        });
        pyodideRef.current.setStderr({
          batched: (text: string) => { outputBuffer += '✖ ' + text + '\n'; },
        });

        try {
          await pyodideRef.current.runPythonAsync(code);
        } catch (err) {
          outputBuffer += `✖ ${(err as Error).message}`;
        }

        setOutput(outputBuffer.trim() || 'Code executed with no output');
      }

      // ── Java (not runnable in browser) ───────────────────────────────────
      else if (language === 'java') {
        setOutput(
          'Java cannot run directly in the browser.\n\n' +
          'Copy the code and run it in a Java environment,\n' +
          'or switch to JavaScript/Python for live execution.'
        );
      }

      else {
        setOutput(`${language} execution is not supported in the browser.`);
      }
    } catch (err) {
      setOutput(`✖ Unexpected error: ${(err as Error).message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = () => {
    const defaultCode = DEFAULT_CODE[language] ?? '';
    setCode(defaultCode);
    setOutput('');
    if (codeSession) {
      supabase
        .from('code_sessions')
        .update({ code_content: defaultCode })
        .eq('id', codeSession.id);
    }
  };

  // ── Copy ──────────────────────────────────────────────────────────────────
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast({ title: 'Code copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-editor-bg rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/20 shrink-0">
        <Select value={language} onValueChange={handleLanguageChange}>
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
          <Button size="sm" variant="ghost" onClick={handleCopy} title="Copy code">
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleReset} title="Reset to default">
            <RotateCcw size={16} />
          </Button>
          <Button
            size="sm"
            onClick={handleRun}
            disabled={isRunning}
            className="gap-1"
          >
            <Play size={16} />
            {isRunning ? 'Running…' : 'Run'}
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={language === 'typescript' ? 'typescript' : language}
          value={code}
          onChange={handleCodeChange}
          theme="vs-dark"
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
          }}
        />
      </div>

      {/* Output panel */}
      <div className="h-44 border-t border-border/20 flex flex-col shrink-0">
        <div className="px-4 py-1.5 text-xs text-muted-foreground border-b border-border/10 shrink-0">
          Output
        </div>
        <pre className="flex-1 px-4 py-3 overflow-auto text-sm font-mono text-green-400 whitespace-pre-wrap leading-relaxed">
          {output || 'Click "Run" to execute your code'}
        </pre>
      </div>
    </div>
  );
}
