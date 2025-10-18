"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleArrowRight } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

// @ts-expect-error
import "highlight.js/styles/github-dark.css";

const formSchema = z.object({
  message: z
    .string()
    .min(1, { message: "پیام نمی‌تواند خالی باشد." })
    .max(500, { message: "حداکثر طول پیام ۵۰۰ کاراکتر است." }),
});

type Message = { id: string; role: "user" | "assistant"; content: string };

export default function Page() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentTyping, setCurrentTyping] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { message: "" },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: values.message,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    form.reset();

    try {
      setIsTyping(true);
      setCurrentTyping("");

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      const data = await res.json();

      if (data.reply?.content) {
        const replyText = data.reply.content;
        let i = 0;

        const typeInterval = setInterval(() => {
          setCurrentTyping((prev) => prev + replyText[i]);
          i++;

          if (i >= replyText.length) {
            clearInterval(typeInterval);
            setIsTyping(false);
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "assistant",
                content: replyText,
              },
            ]);
            setCurrentTyping("");
          }
        }, 20);
      }
    } catch (error) {
      console.error("Error:", error);
      setIsTyping(false);
    }
  };

  return (
    <div className="w-full h-screen flex flex-col gap-4 items-center justify-center max-w-3xl mx-auto py-16">
      {!!messages.length && (
        <div className="flex-1 w-full flex flex-col gap-3 overflow-y-auto">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`p-3 rounded-2xl whitespace-pre-wrap text-base ${
                m.role === "user"
                  ? "bg-blue-100 text-right ml-auto"
                  : "text-left mr-auto"
              }`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  code: ({ node, className, children, ...props }) => (
                    <code
                      className={`px-1 py-0.5 text-xs ${
                        className || ""
                      }`}
                      {...props}>
                      {children}
                    </code>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline">
                      {children}
                    </a>
                  ),
                }}>
                {m.content}
              </ReactMarkdown>
            </div>
          ))}

          {currentTyping && (
            <div className="text-left mr-auto p-3 rounded-lg text-sm">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}>
                {currentTyping}
              </ReactMarkdown>
            </div>
          )}

          {isTyping && !currentTyping && (
            <div className="bg-gray-100 text-gray-500 rounded-lg px-3 py-2 w-fit animate-pulse">
              در حال تایپ...
            </div>
          )}
        </div>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full flex items-center gap-2">
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Ask anything..."
                    className="h-10 rounded-full"
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <Button
            type="submit"
            variant="outline"
            className="h-10 rounded-full"
            disabled={isTyping}>
            <CircleArrowRight />
          </Button>
        </form>
      </Form>
    </div>
  );
}
