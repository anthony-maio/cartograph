import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { GitBranch, Zap, Target, Brain, ArrowRight, Loader2, Key } from "lucide-react";
import { FooterAttribution } from "@/components/FooterAttribution";
import { PROVIDERS, type ProviderId } from "@shared/schema";

const EXAMPLE_REPOS = [
  { name: "expressjs/express", url: "https://github.com/expressjs/express" },
  { name: "fastapi/fastapi", url: "https://github.com/fastapi/fastapi" },
  { name: "pallets/flask", url: "https://github.com/pallets/flask" },
];

const providerList = Object.values(PROVIDERS);

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<ProviderId>("gemini");
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const currentProvider = PROVIDERS[provider];

  const handleAnalyze = async (url?: string) => {
    const targetUrl = url || repoUrl;
    if (!targetUrl.trim()) {
      toast({ title: "Enter a repository URL", variant: "destructive" });
      return;
    }
    if (!apiKey.trim()) {
      toast({ title: "Enter your API key", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/analyze", {
        repoUrl: targetUrl.trim(),
        apiKey: apiKey.trim(),
        provider,
      });
      const { jobId } = await res.json();
      setLocation(`/analysis/${jobId}?key=${encodeURIComponent(apiKey.trim())}&provider=${provider}`);
    } catch (err: any) {
      toast({ title: "Failed to start analysis", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-2xl w-full space-y-10">
          {/* Logo + Title */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Brain className="w-4 h-4" />
              Smart Context Engineering
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              OpenCodeWiki
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
              Stop dumping your entire codebase into LLMs. Generate an intelligent wiki with targeted context — only the files that matter.
            </p>
          </div>

          {/* Input Form */}
          <Card className="border border-border">
            <CardContent className="p-6 space-y-4">
              {/* Repo URL */}
              <div className="relative">
                <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="input-repo-url"
                  placeholder="https://github.com/owner/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  className="pl-10 h-11"
                  disabled={loading}
                />
              </div>

              {/* Provider selector */}
              <div className="flex gap-2">
                <Select value={provider} onValueChange={(v) => setProvider(v as ProviderId)}>
                  <SelectTrigger className="w-[180px] h-11" data-testid="select-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providerList.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    data-testid="input-api-key"
                    type="password"
                    placeholder={currentProvider.keyPlaceholder}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                    className="pl-10 h-11"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Provider info + Analyze button */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {currentProvider.description}{" "}
                  <a href={currentProvider.keyUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    Get a key
                  </a>
                </p>
                <Button
                  data-testid="button-analyze"
                  onClick={() => handleAnalyze()}
                  disabled={loading || !repoUrl.trim() || !apiKey.trim()}
                  className="h-11 px-6 ml-4 flex-shrink-0"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Analyze <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Examples */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Try:</span>
            {EXAMPLE_REPOS.map((repo) => (
              <button
                key={repo.name}
                data-testid={`button-example-${repo.name}`}
                onClick={() => setRepoUrl(repo.url)}
                className="text-sm px-3 py-1 rounded-full border border-border hover:bg-accent transition-colors"
              >
                {repo.name}
              </button>
            ))}
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FeatureCard
              icon={<Target className="w-5 h-5" />}
              title="Selective Analysis"
              description="Scores files by importance — entry points, high fan-in modules, and core abstractions get analyzed first."
            />
            <FeatureCard
              icon={<Zap className="w-5 h-5" />}
              title="3-Pass Pipeline"
              description="Static analysis, then file summaries (fast model), then architecture synthesis (strong model). Each pass builds on the last."
            />
            <FeatureCard
              icon={<Brain className="w-5 h-5" />}
              title="Any Provider"
              description="Works with Gemini, OpenAI, or OpenRouter. Use whatever API key you have — including Anthropic via OpenRouter."
            />
          </div>

          {/* Problem Statement */}
          <div className="border border-border rounded-lg p-6 bg-card space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Why this exists</h3>
            <p className="text-sm text-foreground leading-relaxed">
              Model correctness drops around 32K tokens, even for models claiming 1M+ context windows. Tools like gitingest
              dump everything — you pay for millions of tokens the model mostly ignores, and noise actively degrades
              performance. OpenCodeWiki does what a senior engineer does: scan the structure, identify what matters, then go deep
              only where it counts.
            </p>
          </div>
        </div>
      </div>

      <FooterAttribution />
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="border border-border rounded-lg p-4 space-y-2">
      <div className="text-primary">{icon}</div>
      <h3 className="font-medium text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
