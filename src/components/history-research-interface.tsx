'use client';

import { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Loader2, MapPin, ExternalLink, Search, FileText, Lightbulb, CornerDownRight, Globe2, CheckCircle2, Brain, Clock, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Favicon } from '@/components/ui/favicon';
import { ReasoningDialog } from '@/components/reasoning-dialog';
import { calculateAgentMetrics } from '@/lib/metrics-calculator';

interface Source {
  title: string;
  url: string;
  snippet?: string;
  doi?: string;
  source?: string;
}

interface ResearchImage {
  image_url: string;
  title?: string;
  image_type?: string;
}

interface ToolCall {
  toolCallId: string;
  toolName: string;
  input?: any;
}

interface ToolResult {
  toolCallId: string;
  toolName: string;
  output?: any;
}

interface TextContent {
  type: 'text';
  text: string;
}

interface ReasoningContent {
  type: 'reasoning';
  text: string;
}

type MessageContent = TextContent | ReasoningContent | ToolCall | ToolResult;

interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: MessageContent[];
}

interface HistoryResearchInterfaceProps {
  location: { name: string; lat: number; lng: number } | null;
  onClose: () => void;
  onTaskCreated?: (taskId: string) => void;
  initialTaskId?: string;
}

export function HistoryResearchInterface({ location, onClose, onTaskCreated, initialTaskId }: HistoryResearchInterfaceProps) {
  const [status, setStatus] = useState<'idle' | 'queued' | 'running' | 'completed' | 'error'>('idle');
  const [content, setContent] = useState<string>('');
  const [sources, setSources] = useState<Source[]>([]);
  const [images, setImages] = useState<ResearchImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 10 });
  const [messages, setMessages] = useState<Message[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [shouldContinuePolling, setShouldContinuePolling] = useState(false);
  const [displayLocation, setDisplayLocation] = useState(location);
  const [showReasoningDialog, setShowReasoningDialog] = useState(false);

  // Polling function for long-running tasks
  const pollTaskStatus = async (taskId: string) => {
    try {
      const response = await fetch(`/api/chat/poll?taskId=${taskId}`);
      if (!response.ok) {
        throw new Error('Failed to poll task status');
      }

      const statusData = await response.json();

      // Update progress
      if (statusData.status === 'running') {
        setStatus('running');
        setProgress({
          current: statusData.current_step || 0,
          total: statusData.total_steps || 10,
        });

        // Update messages array
        if (statusData.messages && Array.isArray(statusData.messages)) {
          setMessages(statusData.messages);
        }

        return { completed: false };
      } else if (statusData.status === 'completed') {
        // Set final messages
        if (statusData.messages && Array.isArray(statusData.messages)) {
          setMessages(statusData.messages);
        }

        setContent(statusData.output || '');
        setSources(statusData.sources || []);
        setImages(statusData.images || []);
        setStatus('completed');
        return { completed: true };
      } else if (statusData.status === 'failed') {
        throw new Error(statusData.error || 'Research task failed');
      }

      return { completed: false };
    } catch (err) {
      console.error('Polling error:', err);
      throw err;
    }
  };

  // Load existing research if initialTaskId is provided
  useEffect(() => {
    if (initialTaskId && !taskId) {
      console.log('Loading existing research:', initialTaskId);
      setTaskId(initialTaskId);
      setShouldContinuePolling(true);
    }
  }, [initialTaskId, taskId]);

  useEffect(() => {
    if (!location || initialTaskId) return; // Skip if loading existing research

    const runResearch = async () => {
      setStatus('queued');
      setContent('');
      setSources([]);
      setImages([]);
      setError(null);
      setMessages([]);
      setTaskId(null);
      setShouldContinuePolling(false);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: `Research the history of ${location.name}`,
              },
            ],
            location,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to start research');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                switch (data.type) {
                  case 'task_created':
                    setTaskId(data.taskId);
                    console.log('Task created:', data.taskId);
                    // Notify parent to update URL
                    if (onTaskCreated && data.taskId) {
                      onTaskCreated(data.taskId);
                    }
                    break;
                  case 'status':
                    setStatus(data.status);
                    break;
                  case 'continue_polling':
                    console.log('Switching to client-side polling for task:', data.taskId);
                    setShouldContinuePolling(true);
                    setTaskId(data.taskId);
                    break;
                  case 'progress':
                    setStatus('running');
                    setProgress({
                      current: data.current_step || 0,
                      total: data.total_steps || 10,
                    });
                    break;
                  case 'message_update':
                    // Handle individual message updates from streaming
                    if (data.data && data.content_type) {
                      setMessages((prev) => {
                        const newMessages = [...prev];

                        // Find or create the last assistant message
                        let lastAssistantIndex = -1;
                        for (let i = newMessages.length - 1; i >= 0; i--) {
                          if (newMessages[i].role === 'assistant') {
                            lastAssistantIndex = i;
                            break;
                          }
                        }

                        if (lastAssistantIndex === -1) {
                          // Create new assistant message
                          newMessages.push({
                            role: 'assistant',
                            content: [data.data],
                          });
                        } else {
                          // Append to existing assistant message
                          const existing = newMessages[lastAssistantIndex];
                          if (Array.isArray(existing.content)) {
                            existing.content = [...existing.content, data.data];
                          }
                        }

                        return newMessages;
                      });
                    }
                    break;
                  case 'content':
                    setContent(data.content || '');
                    // Don't set status to completed yet - wait for 'done' event
                    // This ensures all data (sources, images) are received before showing completed state
                    break;
                  case 'sources':
                    setSources(data.sources || []);
                    break;
                  case 'images':
                    setImages(data.images || []);
                    break;
                  case 'error':
                    setError(data.error || 'Unknown error');
                    setStatus('error');
                    break;
                  case 'done':
                    setStatus('completed');
                    break;
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e, 'Line:', line);
              }
            }
          }
        }
      } catch (err) {
        console.error('Research error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
      }
    };

    runResearch();
  }, [location, initialTaskId]); // Add initialTaskId to deps so it doesn't re-run when loading from history

  // Client-side polling effect for long-running tasks
  useEffect(() => {
    if (!shouldContinuePolling || !taskId) return;

    let pollingInterval: NodeJS.Timeout;

    const startPolling = async () => {
      console.log('Starting client-side polling for task:', taskId);

      const poll = async () => {
        try {
          const result = await pollTaskStatus(taskId);

          if (result.completed) {
            console.log('Task completed via client polling');
            setShouldContinuePolling(false);
            if (pollingInterval) {
              clearInterval(pollingInterval);
            }
          }
        } catch (err) {
          console.error('Client polling error:', err);
          setError(err instanceof Error ? err.message : 'Polling error');
          setStatus('error');
          setShouldContinuePolling(false);
          if (pollingInterval) {
            clearInterval(pollingInterval);
          }
        }
      };

      // Poll immediately, then every 2 seconds
      await poll();
      pollingInterval = setInterval(poll, 2000);
    };

    startPolling();

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [shouldContinuePolling, taskId]);

  // Build timeline from messages - show ALL items in order they appear
  const timeline = useMemo(() => {
    if (!messages || messages.length === 0) return [];

    const items: any[] = [];
    let messageIndex = 0;

    // Process messages in order
    messages.forEach((message) => {
      if (!message || !message.role) return;

      if (message.role === 'assistant' && Array.isArray(message.content)) {
        message.content.forEach((item: any) => {
          if (!item || !item.type) return;

          if (item.type === 'text' || item.type === 'reasoning') {
            if (item.text) {
              items.push({
                type: 'text' as const,
                text: item.text,
                contentType: item.type,
                messageIndex,
              });
            }
          } else if (item.type === 'tool-call') {
            if (item.toolCallId && item.toolName) {
              items.push({
                type: 'tool-call' as const,
                toolCallId: item.toolCallId,
                toolName: item.toolName,
                input: item.input,
                messageIndex,
              });
            }
          }
        });
        messageIndex++;
      } else if (message.role === 'tool' && Array.isArray(message.content)) {
        message.content.forEach((item: any) => {
          if (!item || !item.type) return;

          if (item.type === 'tool-result') {
            if (item.toolCallId) {
              items.push({
                type: 'tool-result' as const,
                toolCallId: item.toolCallId,
                output: item.output,
                messageIndex,
              });
            }
          }
        });
        messageIndex++;
      }
    });

    return items;
  }, [messages]);

  // Extract sources from tool results
  const extractSourcesFromToolResult = (result: any): Source[] => {
    if (!result?.output?.value?.sources) return [];
    return result.output.value.sources.map((s: any) => ({
      title: s.title || 'Untitled',
      url: s.url || '#',
      snippet: s.snippet || s.description || '',
      doi: s.doi,
      source: s.source,
    }));
  };

  if (!displayLocation) return null;

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 h-16 border-b border-border/30 bg-background/50 backdrop-blur-xl flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">{displayLocation.name}</h2>
            {displayLocation.lat !== 0 && displayLocation.lng !== 0 && (
              <p className="text-xs text-muted-foreground">
                {displayLocation.lat.toFixed(4)}, {displayLocation.lng.toFixed(4)}
              </p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 mt-16 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Status */}
            {status === 'queued' && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Clock className="h-8 w-8 text-yellow-500 mx-auto mb-4" />
                  </motion.div>
                  <p className="text-sm font-medium mb-1">Research Queued</p>
                  <p className="text-xs text-muted-foreground">Your request will begin shortly...</p>
                </div>
              </div>
            )}

            {status === 'running' && (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-6">
                  <div className="text-center w-full max-w-md">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Sparkles className="h-8 w-8 text-primary mx-auto mb-4" />
                    </motion.div>
                    <p className="text-sm font-medium mb-2">Researching {displayLocation.name}...</p>
                    {shouldContinuePolling && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-3">
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Deep research in progress - this may take up to 30 minutes
                        </p>
                      </div>
                    )}
                    {progress.current > 0 && progress.total > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground mb-3">
                          Step {progress.current} of {progress.total} maximum steps
                        </p>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (progress.current / progress.total) * 100)}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Activity Feed - Show during running and completed */}
                {timeline.length > 0 && (status === 'running' || status === 'completed') && (
                  <div className="space-y-4">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Research Trace
                    </div>
                    {timeline.map((item, idx) => {
                      if (!item || !item.type) return null;

                      if (item.type === 'text') {
                        const isReasoning = item.contentType === 'reasoning';

                        // Truncate very long reasoning text
                        const displayText = isReasoning && item.text.length > 500
                          ? item.text.slice(0, 500) + '...'
                          : item.text;

                        return (
                          <motion.div
                            key={`text-${idx}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div
                              className={`flex items-start gap-2.5 p-3 rounded-lg border overflow-hidden backdrop-blur-sm ${
                                isReasoning
                                  ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40'
                                  : 'bg-background/70 border-border/60'
                              }`}
                            >
                              {isReasoning && (
                                <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1 min-w-0">
                                {isReasoning && (
                                  <div className="text-xs font-semibold text-amber-900 dark:text-amber-100 mb-1.5">
                                    Reasoning
                                  </div>
                                )}
                                <div className="text-xs text-foreground/80 whitespace-pre-wrap break-words leading-relaxed">
                                  {displayText}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      } else if (item.type === 'tool-call') {
                        // Safety check
                        if (!item.toolCallId || !item.toolName) return null;

                        // Find the corresponding result if it exists
                        const resultItem = timeline.find(
                          (t: any) => t && t.type === 'tool-result' && t.toolCallId === item.toolCallId
                        );
                        const hasResult = !!resultItem;

                        return (
                          <motion.div
                            key={`tool-call-${idx}-${item.toolCallId}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className={`overflow-hidden rounded-lg border backdrop-blur-sm ${
                              hasResult
                                ? 'border-green-500/40 bg-green-500/10'
                                : 'border-blue-500/40 bg-blue-500/10'
                            }`}>
                              <div className={`px-3 py-2 border-b ${
                                hasResult
                                  ? 'bg-green-500/10 border-green-500/20'
                                  : 'bg-blue-500/10 border-blue-500/20'
                              }`}>
                                <div className={`flex items-center gap-2 ${
                                  hasResult
                                    ? 'text-green-700 dark:text-green-400'
                                    : 'text-blue-700 dark:text-blue-400'
                                }`}>
                                  {hasResult ? (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  ) : (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  )}
                                  <span className="text-xs font-semibold">{item.toolName}</span>
                                </div>
                              </div>
                              <div className="px-3 py-2.5">
                                <div className="text-xs text-foreground/80 break-words whitespace-pre-wrap">
                                  {typeof item.input === 'object'
                                    ? item.input?.query || JSON.stringify(item.input, null, 2)
                                    : String(item.input || '')}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      } else if (item.type === 'tool-result') {
                        // Extract sources from the result - try multiple possible structures
                        const sources = item.output?.value?.sources || item.output?.sources || [];
                        const resultText = item.output?.value?.text || item.output?.text || '';
                        const hasContent = sources.length > 0 || resultText;

                        if (!hasContent) return null;

                        return (
                          <motion.div
                            key={`tool-result-${idx}-${item.toolCallId}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex gap-2.5 pl-1"
                          >
                            <div className="flex items-start pt-1">
                              <CornerDownRight className="h-3.5 w-3.5 text-green-600/40 dark:text-green-400/40 flex-shrink-0" />
                            </div>
                            <div className="flex-1 space-y-1.5 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                                <div className="text-[10px] font-medium text-green-700 dark:text-green-400 uppercase tracking-wide">
                                  {sources.length > 0 ? `${sources.length} ${sources.length === 1 ? 'Source' : 'Sources'} Found` : 'Result'}
                                </div>
                              </div>
                              {sources.length > 0 && (
                                <div className="space-y-1.5">
                                  {sources.slice(0, 3).map((source: any, idx: number) => (
                                    <a
                                      key={idx}
                                      href={source.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="group flex items-start gap-2 p-2.5 bg-muted/30 rounded-lg border hover:border-primary transition-colors"
                                    >
                                      {source.url && (
                                        <Favicon url={source.url} className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium line-clamp-1 group-hover:text-primary transition-colors">
                                          {source.title || 'Untitled'}
                                        </div>
                                        {source.snippet && (
                                          <div className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                                            {source.snippet}
                                          </div>
                                        )}
                                      </div>
                                      <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </a>
                                ))}
                              </div>
                              )}
                              {resultText && (
                                <div className="text-xs text-muted-foreground p-2.5 bg-muted/20 rounded-lg border border-border/50 max-h-32 overflow-y-auto">
                                  <pre className="whitespace-pre-wrap font-mono text-[10px]">{resultText}</pre>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      }
                      return null;
                    })}
                  </div>
                )}
              </div>
            )}

            {status === 'error' && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-destructive mb-2">Research Failed</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            )}

            {/* Research Content */}
            {content && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center justify-between gap-2 text-sm font-semibold text-green-700 dark:text-green-400 bg-green-500/10 rounded-lg px-4 py-3 border border-green-500/20 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Research Complete</span>
                  </div>
                  {status === 'completed' && messages && messages.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 bg-background hover:bg-accent border-green-500/30"
                      onClick={() => setShowReasoningDialog(true)}
                    >
                      <Brain className="h-3.5 w-3.5" />
                      <span className="text-xs">View Reasoning</span>
                    </Button>
                  )}
                </motion.div>
                <div className="prose prose-sm dark:prose-invert max-w-none bg-background rounded-lg p-6 border shadow-sm prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:leading-relaxed prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-code:text-sm prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted prose-pre:border">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                </div>
              </motion.div>
            )}

            {/* Images */}
            {images.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Research Images</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {images.map((image, index) => (
                    <div key={index} className="border rounded-lg overflow-hidden">
                      <img
                        src={image.image_url}
                        alt={image.title || `Research image ${index + 1}`}
                        className="w-full h-auto"
                      />
                      {image.title && (
                        <div className="p-3 bg-muted">
                          <p className="text-sm font-medium">{image.title}</p>
                          {image.image_type && (
                            <p className="text-xs text-muted-foreground capitalize">{image.image_type}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sources Summary */}
            {sources.length > 0 && status === 'completed' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">All Sources</h3>
                  <span className="text-sm text-muted-foreground">{sources.length} total</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sources.map((source, index) => {
                    return (
                      <a
                        key={index}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start gap-2 p-2.5 bg-muted/30 rounded-lg border hover:border-primary transition-colors"
                      >
                        {source.url && (
                          <Favicon url={source.url} className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium line-clamp-2 group-hover:text-primary transition-colors">
                            {source.title}
                          </div>
                          {source.snippet && (
                            <div className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                              {source.snippet}
                            </div>
                          )}
                          {source.doi && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded font-medium">
                                DOI
                              </span>
                              <span className="text-[10px] text-muted-foreground truncate">
                                {source.doi}
                              </span>
                            </div>
                          )}
                        </div>
                        <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Research Stats */}
            {status === 'completed' && timeline.length > 0 && (() => {
              const metrics = calculateAgentMetrics(messages);
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="grid grid-cols-3 gap-4 p-5 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20 shadow-sm"
                >
                  <div className="text-center">
                    <motion.p
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.2 }}
                      className="text-3xl font-bold text-primary mb-1"
                    >
                      {metrics.searches}
                    </motion.p>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Searches</p>
                  </div>
                  <div className="text-center">
                    <motion.p
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.3 }}
                      className="text-3xl font-bold text-primary mb-1"
                    >
                      {metrics.sourcesRead}
                    </motion.p>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sources</p>
                  </div>
                  <div className="text-center">
                    <motion.p
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.4 }}
                      className="text-3xl font-bold text-primary mb-1"
                    >
                      {metrics.hoursActuallySaved.toFixed(1)}h
                    </motion.p>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Time Saved</p>
                  </div>
                </motion.div>
              );
            })()}
          </div>
        </ScrollArea>
      </div>

      {/* Reasoning Dialog */}
      <ReasoningDialog
        open={showReasoningDialog}
        onOpenChange={setShowReasoningDialog}
        stepCount={messages?.length}
      >
        {timeline.length > 0 ? (
          timeline.map((item, idx) => {
            if (!item || !item.type) return null;

            if (item.type === 'text') {
              const isReasoning = item.contentType === 'reasoning';

              return (
                <div
                  key={`text-${idx}`}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border overflow-hidden ${
                    isReasoning
                      ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40'
                      : 'bg-background/70 border-border/60'
                  }`}
                >
                  {isReasoning && (
                    <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    {isReasoning && (
                      <div className="text-xs font-semibold text-amber-900 dark:text-amber-100 mb-1.5">
                        Reasoning
                      </div>
                    )}
                    <div className="text-xs text-foreground/80 whitespace-pre-wrap break-words leading-relaxed">
                      {item.text}
                    </div>
                  </div>
                </div>
              );
            } else if (item.type === 'tool-call') {
              if (!item.toolCallId || !item.toolName) return null;

              const resultItem = timeline.find(
                (t: any) => t && t.type === 'tool-result' && t.toolCallId === item.toolCallId
              );
              const hasResult = !!resultItem;

              return (
                <div
                  key={`tool-call-${idx}-${item.toolCallId}`}
                  className={`overflow-hidden rounded-lg border transition-colors ${
                    hasResult
                      ? 'border-green-500/40 bg-green-500/10'
                      : 'border-primary/30 bg-primary/10'
                  }`}
                >
                  <div
                    className={`px-3 py-2 border-b transition-colors ${
                      hasResult ? 'bg-green-500/10 border-green-500/20' : 'bg-primary/10 border-primary/20'
                    }`}
                  >
                    <div
                      className={`flex items-center gap-2 transition-colors ${
                        hasResult ? 'text-green-700 dark:text-green-400' : 'text-primary'
                      }`}
                    >
                      <Search className="h-3.5 w-3.5" />
                      <span className="text-xs font-semibold">{item.toolName}</span>
                    </div>
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="text-xs text-foreground/80 break-words whitespace-pre-wrap">
                      {typeof item.input === 'object'
                        ? item.input?.query || JSON.stringify(item.input, null, 2)
                        : String(item.input || '')}
                    </div>
                  </div>
                </div>
              );
            } else if (item.type === 'tool-result') {
              const sources = item.output?.value?.sources || item.output?.sources || [];
              const resultText = item.output?.value?.text || item.output?.text || '';
              const hasContent = sources.length > 0 || resultText;

              if (!hasContent) return null;

              return (
                <div
                  key={`tool-result-${idx}-${item.toolCallId}`}
                  className="overflow-hidden rounded-lg border border-green-500/20 bg-background/50 ml-4"
                >
                  <div className="px-3 py-2 bg-green-500/10 border-b border-green-500/20">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <CornerDownRight className="h-3 w-3" />
                      <span className="text-[10px] font-medium uppercase tracking-wide">
                        {sources.length > 0 ? `${sources.length} ${sources.length === 1 ? 'Source' : 'Sources'} Found` : 'Result'}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    {sources.length > 0 && sources.slice(0, 3).map((source: any, sourceIdx: number) => (
                      <a
                        key={sourceIdx}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start gap-2 p-2.5 bg-muted/30 rounded-lg border hover:border-primary transition-colors"
                      >
                        {source.url && (
                          <Favicon url={source.url} className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium line-clamp-1 group-hover:text-primary transition-colors">
                            {source.title || 'Untitled'}
                          </div>
                          {source.snippet && (
                            <div className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                              {source.snippet}
                            </div>
                          )}
                        </div>
                        <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    ))}
                    {sources.length > 3 && (
                      <div className="text-[10px] text-center text-muted-foreground py-1">
                        +{sources.length - 3} more sources
                      </div>
                    )}
                    {resultText && (
                      <div className="text-xs text-muted-foreground p-2.5 bg-muted/20 rounded-lg border border-border/50 max-h-32 overflow-y-auto">
                        <pre className="whitespace-pre-wrap font-mono text-[10px]">{resultText}</pre>
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            return null;
          })
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No activity data available for this task.
          </div>
        )}
      </ReasoningDialog>
    </div>
  );
}
