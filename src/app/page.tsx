"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import "highlight.js/styles/github-dark-dimmed.css";
import Link from "next/link";

const formSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, { message: "Message cannot be empty." })
    .max(500, { message: "Max length is 500 characters." }),
});

type Message = { id: string; role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { message: "" },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: values.message.trim(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    form.reset();

    try {
      setIsTyping(true);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      const data = await res.json();

      if (data.reply?.content) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.reply.content,
          },
        ]);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#212121] text-white pt-0 md:pt-16 pb-24">
      <div className="flex-1 overflow-y-auto px-4 py-8 max-w-3xl mx-auto w-full space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={clsx(
              "px-2 py-1.5 rounded-2xl text-base whitespace-pre-wrap transition-all",
              m.role === "user"
                ? "bg-[#303030] ml-auto max-w-3/4 w-fit"
                : "mr-auto"
            )}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}>
              {m.content}
            </ReactMarkdown>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-1 text-gray-400 text-sm ml-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
          </div>
        )}
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={clsx(
            "w-full max-w-3xl flex flex-col items-center justify-center fixed left-1/2 -translate-x-1/2 px-4",
            messages.length ? "bottom-5" : "top-1/2 -translate-y-1/2"
          )}>
          {!messages.length && (
            <h1 className="text-lg md:text-3xl">What’s on the agenda today?</h1>
          )}
          <div className="flex items-end gap-3 w-full pt-6 md:pt-10 pb-4">
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Textarea
                      {...field}
                      aria-label="Chat message input"
                      placeholder="Type a message..."
                      rows={1}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          form.handleSubmit(onSubmit)();
                        }
                      }}
                      className="min-h-[1lh] max-h-[10lh] rounded-2xl !text-base resize-none field-sizing-content overflow-y-auto bg-[#303030] border-0 py-2 px-4"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="size-12 rounded-2xl flex items-center justify-center transition-all shadow-md bg-[#303030] cursor-pointer"
              disabled={isTyping}>
              <ArrowRight className="size-5" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Link href="https://github.com/mohsen104/" target="_blank">
              <img
                src="https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white"
                alt="github"
                width={95.5}
                height={28}
                className="rounded-xl"
              />
            </Link>
            <Link
              href="https://www.linkedin.com/in/mohsenkarimvand/"
              target="_blank">
              <img
                src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white"
                alt="linkedIn"
                width={91}
                height={28}
                className="rounded-xl"
              />
            </Link>
          </div>
        </form>
      </Form>
    </div>
  );
}
