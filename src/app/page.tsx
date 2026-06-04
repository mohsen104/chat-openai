"use client";

import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { useEffect, useRef, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import ReactMarkdown from "react-markdown";
import { Send, Square, Plus, Copy, Check, Bot, User } from "lucide-react";
import "highlight.js/styles/github-dark-dimmed.css";

type Role = "user" | "assistant";

interface Message {
  id: string;
  role: Role;
  content: string;
}

const schema = z.object({
  prompt: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

const SUGGESTIONS = [
  "یه متن تبلیغاتی برام بنویس",
  "کد Python برای مرتب‌سازی لیست",
  "تفاوت REST و GraphQL چیه؟",
  "یه ایمیل رسمی به انگلیسی بنویس",
];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
      aria-label="Copy message">
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function CodeCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-[11px] font-mono text-gray-400 hover:text-gray-100 transition-colors px-2 py-1 rounded-md hover:bg-gray-700/60 border border-transparent hover:border-gray-600/50"
      aria-label="Copy code">
      {copied ? (
        <>
          <Check size={12} className="text-green-400" />
          <span className="text-green-400">کپی شد</span>
        </>
      ) : (
        <>
          <Copy size={12} />
          <span>کپی کردن</span>
        </>
      )}
    </button>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const userScrolledRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, reset, setValue, watch } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: { prompt: "" },
    });

  const promptValue = watch("prompt");

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [promptValue]);

  const scrollToBottom = useCallback(() => {
    if (!userScrolledRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isStreaming) scrollToBottom();
  }, [isStreaming, scrollToBottom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
      userScrolledRef.current = !isAtBottom;
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  };

  const startNewChat = () => {
    stopGeneration();
    setMessages([]);
    setError(null);
    reset();
    textareaRef.current?.focus();
  };

  const onSubmit = async ({ prompt }: FormValues) => {
    if (isStreaming) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt.trim(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setError(null);
    reset();
    userScrolledRef.current = false;

    const apiMessages = updatedMessages.map(({ role, content }) => ({
      role,
      content,
    }));

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    setIsStreaming(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error("خطا در دریافت پاسخ");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m,
          ),
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
      } else {
        setError("مشکلی پیش آمد. دوباره امتحان کن.");
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(onSubmit)();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-screen bg-[#212121] text-gray-100">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
        <button
          onClick={startNewChat}
          className="cursor-pointer flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-100 transition-colors px-2 py-1 rounded hover:bg-gray-700">
          گفت‌گو جدید
          <Plus size={16} />
        </button>
        <div className="flex items-center gap-2">
          <Bot size={20} className="text-green-400" />
        </div>
      </header>

      <div ref={containerRef} className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
            <h1 className="text-2xl font-semibold text-gray-200">
              چطور می‌تونم کمک کنم؟
            </h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setValue("prompt", s);
                    textareaRef.current?.focus();
                  }}
                  className="cursor-pointer text-sm text-right px-4 py-3 rounded-xl border border-gray-600 hover:border-gray-400 hover:bg-gray-700/50 transition-colors text-gray-300">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 group ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}>
                {message.role === "assistant" && (
                  <div className="size-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot size={20} className="text-white" />
                  </div>
                )}

                <div
                  className={`relative max-w-[85%] ${
                    message.role === "user"
                      ? "bg-[#2f2f2f] rounded-2xl px-4 py-2.5"
                      : "text-gray-100"
                  }`}>
                  {message.role === "assistant" && message.content === "" ? (
                    <TypingIndicator />
                  ) : message.role === "assistant" ? (
                    <>
                      <div
                        dir="auto"
                        className="prose prose-invert prose-sm max-w-none ">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeHighlight]}
                          components={{
                            code({
                              className,
                              children,
                              ...props
                            }: React.ComponentPropsWithoutRef<"code"> & {
                              inline?: boolean;
                            }) {
                              const isInline =
                                !className?.includes("language-");
                              const language =
                                className?.replace("language-", "") ?? "";
                              const codeText = String(children).replace(
                                /\n$/,
                                "",
                              );

                              if (isInline) {
                                return (
                                  <code
                                    className="px-1.5 py-0.5 rounded-md text-[0.82em] font-mono bg-gray-800/80 text-emerald-300 border border-gray-700/60"
                                    {...props}>
                                    {children}
                                  </code>
                                );
                              }

                              return (
                                <div className="group/code mb-2 rounded-xl overflow-hidden border border-gray-700/50 bg-[#0d1117]">
                                  <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-gray-700/50">
                                    <div className="flex items-center gap-2">
                                      <span className="w-3 h-3 rounded-full bg-red-500/70" />
                                      <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                                      <span className="w-3 h-3 rounded-full bg-green-500/70" />
                                      {language && (
                                        <span className="ml-2 mt-1.5 text-[11px] font-mono text-gray-400 uppercase tracking-widest">
                                          {language}
                                        </span>
                                      )}
                                    </div>
                                    <CodeCopyButton text={codeText} />
                                  </div>
                                  <div className="overflow-x-auto">
                                    <code
                                      className={`${className} block p-4 text-[13px] font-mono leading-relaxed text-gray-200`}
                                      {...props}>
                                      {children}
                                    </code>
                                  </div>
                                </div>
                              );
                            },
                            table({ children }) {
                              return (
                                <div className="my-4 overflow-x-auto">
                                  <table className="w-full text-sm">
                                    {children}
                                  </table>
                                </div>
                              );
                            },
                            thead({ children }) {
                              return <thead>{children}</thead>;
                            },
                            th({ children }) {
                              return (
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-700">
                                  {children}
                                </th>
                              );
                            },
                            tbody({ children }) {
                              return <tbody>{children}</tbody>;
                            },
                            tr({ children }) {
                              return (
                                <tr className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
                                  {children}
                                </tr>
                              );
                            },
                            td({ children }) {
                              return (
                                <td className="px-4 py-3 text-gray-300">
                                  {children}
                                </td>
                              );
                            },
                          }}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                      <div className="flex justify-end mt-1">
                        <CopyButton text={message.content} />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">
                      {message.content}
                    </p>
                  )}
                </div>

                {message.role === "user" && (
                  <div className="size-10 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User size={16} className="text-white" />
                  </div>
                )}
              </div>
            ))}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {error && (
        <div className="mx-auto mb-2 max-w-2xl w-full px-4">
          <p className="text-sm text-red-400 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">
            {error}
          </p>
        </div>
      )}

      <div className="px-4 pb-4 pt-2 max-w-2xl mx-auto w-full">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex items-end gap-2 bg-[#2f2f2f] rounded-2xl px-4 py-3 border border-gray-600/50 focus-within:border-gray-500 transition-colors">
          <textarea
            {...register("prompt")}
            ref={(el) => {
              register("prompt").ref(el);
              (
                textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>
              ).current = el;
            }}
            rows={1}
            placeholder="پیامی بنویس..."
            disabled={isStreaming}
            onKeyDown={handleKeyDown}
            className="flex-1 min-h-7 bg-transparent resize-none outline-none text-sm text-gray-100 placeholder-gray-500 leading-6 max-h-[200px] overflow-y-auto disabled:opacity-50"
            style={{ direction: "rtl" }}
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={stopGeneration}
              className="cursor-pointer flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-gray-200 transition-colors"
              aria-label="Stop generation">
              <Square size={14} className="text-black fill-black" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!promptValue?.trim()}
              className="cursor-pointer flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Send message">
              <Send size={14} className="text-black" />
            </button>
          )}
        </form>
        <p className="text-center text-xs text-gray-600 mt-2">
          Enter برای ارسال · Shift+Enter برای خط جدید
        </p>
      </div>
    </div>
  );
}
