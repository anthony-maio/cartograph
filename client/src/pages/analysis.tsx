import { useState, useEffect, useMemo } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, FolderTree, Loader2, CheckCircle2, AlertCircle,
  Copy, Download, Send, ChevronRight, ChevronDown, Zap,
  GitBranch, BarChart3, BookOpen, Target, ArrowLeft
} from "lucide-react";
import { Link } from "wouter";
import { FooterAttribution } from "@/components/FooterAttribution";
import type { WikiResult, FileSummary, FileNode, ContextGuide, ProviderId } from "@shared/schema";

interface WikiData {
  result: WikiResult;
  fileAnalysis: FileNode[];
  fileSummaries: FileSummary[];
  dependencyEdges: Array<{ from: string; to: string }>;
}

interface ContextResult {
  files: Array<{ path: string; reason: string; content: string }>;
  totalTokens: number;
}

function getParamsFromUrl(): { apiKey: string; provider: ProviderId } {
  if (typeof window === "undefined") return { apiKey: "", provider: "gemini" };
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  return {
    apiKey: params.get("key") || "",
    provider: (params.get("provider") || "gemini") as ProviderId,
  };
}

export default function Analysis() {
  const [, params] = useRoute("/analysis/:jobId");
  const jobId = params?.jobId || "";
  const { apiKey, provider } = getParamsFromUrl();
  const { toast } = useToast();

  // Poll job status
  const statusQuery = useQuery<any>({
    queryKey: ["/api/status", jobId],
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === "complete" || data?.status === "error") return false;
      return 2000;
    },
    enabled: !!jobId,
  });

  // Fetch wiki when complete
  const wikiQuery = useQuery<WikiData>({
    queryKey: ["/api/wiki", jobId],
    enabled: statusQuery.data?.status === "complete",
  });

  const status = statusQuery.data;
  const wiki = wikiQuery.data;

  if (!jobId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">No job ID provided</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center gap-4 bg-card">
        <Link href="/">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">
            {wiki?.result?.repoName || status?.repoUrl || "Analyzing..."}
          </h1>
          {status && (
            <p className="text-xs text-muted-foreground">{status.message}</p>
          )}
        </div>
        {status && <StatusBadge status={status.status} />}
      </header>

      {/* Content */}
      {status?.status !== "complete" ? (
        <ProgressView status={status} />
      ) : wiki ? (
        <WikiView wiki={wiki} jobId={jobId} apiKey={apiKey} provider={provider} />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      <FooterAttribution />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
    cloning: { label: "Cloning", variant: "secondary" },
    analyzing: { label: "Analyzing", variant: "secondary" },
    summarizing: { label: "Summarizing", variant: "default" },
    synthesizing: { label: "Synthesizing", variant: "default" },
    complete: { label: "Complete", variant: "default" },
    error: { label: "Error", variant: "destructive" },
  };
  const c = config[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={c.variant} data-testid="badge-status">{c.label}</Badge>;
}

function ProgressView({ status }: { status: any }) {
  if (!status) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status.status === "error") {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Analysis Failed</h2>
            <p className="text-sm text-muted-foreground">{status.error || "Unknown error"}</p>
            <Link href="/">
              <Button data-testid="button-try-again">Try Again</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const steps = [
    { key: "cloning", label: "Clone Repository", icon: GitBranch },
    { key: "analyzing", label: "Static Analysis", icon: FolderTree },
    { key: "summarizing", label: "File Summaries", icon: FileText },
    { key: "synthesizing", label: "Architecture Synthesis", icon: BookOpen },
  ];

  const currentIdx = steps.findIndex(s => s.key === status.status);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <Card className="max-w-lg w-full">
        <CardContent className="p-6 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{status.message}</span>
              <span className="text-muted-foreground">{status.progress}%</span>
            </div>
            <Progress value={status.progress} data-testid="progress-bar" />
          </div>

          <div className="space-y-3">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx === currentIdx;
              const isDone = idx < currentIdx;
              return (
                <div
                  key={step.key}
                  className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                    isActive ? "bg-primary/10 text-primary" :
                    isDone ? "text-muted-foreground" :
                    "text-muted-foreground/50"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  ) : isActive ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">{step.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WikiView({ wiki, jobId, apiKey, provider }: { wiki: WikiData; jobId: string; apiKey: string; provider: ProviderId }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [expandedGuides, setExpandedGuides] = useState<Set<number>>(new Set());

  const { result, fileAnalysis, fileSummaries } = wiki;

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-sidebar flex-shrink-0 hidden md:block">
        <ScrollArea className="h-[calc(100vh-57px)]">
          <div className="p-4 space-y-1">
            <SidebarButton
              active={activeTab === "overview"}
              onClick={() => setActiveTab("overview")}
              icon={<BookOpen className="w-4 h-4" />}
              label="Overview"
            />
            <SidebarButton
              active={activeTab === "architecture"}
              onClick={() => setActiveTab("architecture")}
              icon={<FolderTree className="w-4 h-4" />}
              label="Architecture"
            />
            <SidebarButton
              active={activeTab === "patterns"}
              onClick={() => setActiveTab("patterns")}
              icon={<Zap className="w-4 h-4" />}
              label="Patterns"
            />
            <SidebarButton
              active={activeTab === "context"}
              onClick={() => setActiveTab("context")}
              icon={<Target className="w-4 h-4" />}
              label="Context Builder"
            />
            <SidebarButton
              active={activeTab === "stats"}
              onClick={() => setActiveTab("stats")}
              icon={<BarChart3 className="w-4 h-4" />}
              label="Statistics"
            />

            <Separator className="my-3" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 mb-2">
              Modules
            </p>
            {result.modules.map((mod) => (
              <SidebarButton
                key={mod.name}
                active={activeTab === "module" && selectedModule === mod.name}
                onClick={() => { setActiveTab("module"); setSelectedModule(mod.name); }}
                icon={<FolderTree className="w-4 h-4" />}
                label={mod.name}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {/* Mobile Tab Bar */}
        <div className="md:hidden border-b border-border">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="architecture">Architecture</TabsTrigger>
              <TabsTrigger value="context">Context</TabsTrigger>
              <TabsTrigger value="stats">Stats</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="h-[calc(100vh-57px)]">
          <div className="max-w-3xl mx-auto p-6 pb-16">
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-1" data-testid="text-repo-name">{result.repoName}</h2>
                  <div className="flex gap-2 mb-4">
                    <Badge variant="secondary">{result.totalFiles} files</Badge>
                    <Badge variant="secondary">{result.analyzedFiles} analyzed</Badge>
                    <Badge variant="default">~{Math.round(result.totalTokensSaved / 1000)}K tokens saved</Badge>
                  </div>
                </div>
                <MarkdownContent content={result.overview} />
              </div>
            )}

            {activeTab === "architecture" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">Architecture</h2>
                <MarkdownContent content={result.architecture} />
              </div>
            )}

            {activeTab === "patterns" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">Patterns & Conventions</h2>
                <MarkdownContent content={result.patterns} />
              </div>
            )}

            {activeTab === "context" && (
              <ContextBuilder jobId={jobId} apiKey={apiKey} provider={provider} wiki={result} fileSummaries={fileSummaries} />
            )}

            {activeTab === "stats" && (
              <StatsView files={fileAnalysis} summaries={fileSummaries} edges={wiki.dependencyEdges} />
            )}

            {activeTab === "module" && selectedModule && (
              <ModuleView
                module={result.modules.find(m => m.name === selectedModule)}
              />
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function SidebarButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left ${
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function ContextBuilder({ jobId, apiKey, provider, wiki, fileSummaries }: {
  jobId: string; apiKey: string; provider: ProviderId; wiki: WikiResult; fileSummaries: FileSummary[];
}) {
  const [task, setTask] = useState("");
  const { toast } = useToast();

  const contextMutation = useMutation({
    mutationFn: async (taskDesc: string) => {
      const res = await apiRequest("POST", `/api/context/${jobId}`, {
        task: taskDesc,
        apiKey,
        provider,
      });
      return await res.json() as ContextResult;
    },
    onError: (err: any) => {
      toast({ title: "Context selection failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!task.trim()) return;
    contextMutation.mutate(task.trim());
  };

  const copyContext = () => {
    if (!contextMutation.data) return;
    const text = contextMutation.data.files.map(f =>
      `=== ${f.path} ===\nReason: ${f.reason}\n\n${f.content}`
    ).join("\n\n" + "=".repeat(60) + "\n\n");

    const header = `# Context for: ${task}\n# Files: ${contextMutation.data.files.length}\n# Tokens: ~${contextMutation.data.totalTokens.toLocaleString()}\n\n`;

    navigator.clipboard.writeText(header + text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Context Builder</h2>
        <p className="text-muted-foreground text-sm">
          Describe what you want to do, and get exactly the files an AI needs — nothing more.
        </p>
      </div>

      {/* Pre-built guides */}
      {wiki.contextGuide.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Quick picks from analysis:</p>
          <div className="flex gap-2 flex-wrap">
            {wiki.contextGuide.map((guide, i) => (
              <button
                key={i}
                onClick={() => setTask(guide.taskType)}
                className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-accent transition-colors"
                data-testid={`button-guide-${i}`}
              >
                {guide.taskType}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Task input */}
      <div className="flex gap-2">
        <Textarea
          data-testid="input-task"
          placeholder="e.g., Add a new API endpoint for user preferences"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          className="min-h-[80px] resize-none"
        />
      </div>
      <Button
        data-testid="button-get-context"
        onClick={handleSubmit}
        disabled={!task.trim() || contextMutation.isPending}
        className="w-full"
      >
        {contextMutation.isPending ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Selecting files...</>
        ) : (
          <><Send className="w-4 h-4 mr-2" /> Get Relevant Context</>
        )}
      </Button>

      {/* Results */}
      {contextMutation.data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Badge variant="secondary">{contextMutation.data.files.length} files</Badge>
              <Badge variant="default">~{contextMutation.data.totalTokens.toLocaleString()} tokens</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={copyContext} data-testid="button-copy-context">
              <Copy className="w-3 h-3 mr-1" /> Copy All
            </Button>
          </div>

          {contextMutation.data.files.map((file) => (
            <ContextFileCard key={file.path} file={file} />
          ))}
        </div>
      )}
    </div>
  );
}

function ContextFileCard({ file }: { file: { path: string; reason: string; content: string } }) {
  const [expanded, setExpanded] = useState(false);
  const tokens = Math.ceil(file.content.length / 4);

  return (
    <Card>
      <CardHeader className="p-4 pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <CardTitle className="text-sm font-mono">{file.path}</CardTitle>
          <Badge variant="secondary" className="ml-auto text-xs">~{tokens.toLocaleString()} tokens</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1 ml-6">{file.reason}</p>
      </CardHeader>
      {expanded && (
        <CardContent className="p-4 pt-0">
          <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto">
            {file.content}
          </pre>
        </CardContent>
      )}
    </Card>
  );
}

function StatsView({ files, summaries, edges }: {
  files: FileNode[]; summaries: FileSummary[]; edges: Array<{ from: string; to: string }>;
}) {
  const langCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of files) {
      counts[f.language] = (counts[f.language] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [files]);

  const totalLines = files.reduce((acc, f) => acc + f.lines, 0);
  const totalBytes = files.reduce((acc, f) => acc + f.bytes, 0);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Repository Statistics</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Files" value={files.length.toLocaleString()} />
        <StatCard label="Total Lines" value={totalLines.toLocaleString()} />
        <StatCard label="Size" value={formatBytes(totalBytes)} />
        <StatCard label="Dependencies" value={edges.length.toLocaleString()} />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Languages</h3>
        <div className="space-y-2">
          {langCounts.slice(0, 10).map(([lang, count]) => (
            <div key={lang} className="flex items-center gap-3">
              <span className="text-sm font-mono w-24 text-right">{lang}</span>
              <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                <div
                  className="h-full bg-primary/60 rounded-full transition-all"
                  style={{ width: `${(count / files.length) * 100}%` }}
                />
              </div>
              <span className="text-sm text-muted-foreground w-12">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Top Files by Importance</h3>
        <div className="space-y-1">
          {files.slice(0, 20).map((f) => (
            <div key={f.path} className="flex items-center gap-2 text-sm py-1">
              <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded w-8 text-center">{f.importanceScore}</span>
              <span className="font-mono truncate flex-1">{f.path}</span>
              <span className="text-muted-foreground text-xs">{f.language}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-2xl font-bold" data-testid={`text-stat-${label.toLowerCase().replace(/\s/g, "-")}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function ModuleView({ module }: { module?: { name: string; description: string; files: FileSummary[] } }) {
  if (!module) return <p className="text-muted-foreground">Module not found</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{module.name}</h2>
        <p className="text-muted-foreground mt-1">{module.description}</p>
      </div>

      <div className="space-y-4">
        {module.files.map((file) => (
          <Card key={file.path}>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-mono">{file.path}</CardTitle>
              <Badge variant="secondary" className="w-fit">{file.architecturalRole}</Badge>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2">
              <p className="text-sm">{file.purpose}</p>
              {file.publicApi && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Public API</p>
                  <pre className="text-xs font-mono bg-muted p-2 rounded overflow-x-auto">{file.publicApi}</pre>
                </div>
              )}
              {file.dependencies.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {file.dependencies.map((dep) => (
                    <Badge key={dep} variant="secondary" className="text-xs">{dep}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  // Simple markdown to HTML conversion
  const html = useMemo(() => {
    let result = content
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>');
    // Wrap in paragraphs
    result = '<p>' + result + '</p>';
    // Fix list items
    result = result.replace(/<\/p><li>/g, '<li>').replace(/<\/li><p>/g, '</li>');
    // Wrap consecutive li in ul
    result = result.replace(/(<li>[\s\S]*?<\/li>(?:<br\/>)?)+/g, (match) => '<ul>' + match + '</ul>');
    return result;
  }, [content]);

  return <div className="wiki-content" dangerouslySetInnerHTML={{ __html: html }} />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
