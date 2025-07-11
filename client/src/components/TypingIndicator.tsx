import { Bot } from "lucide-react";

export function TypingIndicator() {
  return (
    <div className="flex justify-start animate-fade-in">
      <div className="max-w-[80%] lg:max-w-[60%]">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
            <Bot className="text-white" size={12} />
          </div>
          <div className="flex-1">
            <div className="agent-bubble px-4 py-3 rounded-2xl rounded-tl-md">
              <div className="flex items-center space-x-1">
                <div className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-typing"></div>
                <div className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-typing" style={{ animationDelay: "0.2s" }}></div>
                <div className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-typing" style={{ animationDelay: "0.4s" }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
