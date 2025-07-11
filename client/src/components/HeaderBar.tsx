import { Moon, Sun, Plus, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderBarProps {
  connectionStatus: "connected" | "connecting" | "disconnected";
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onNewChat: () => void;
}

export function HeaderBar({
  connectionStatus,
  theme,
  onToggleTheme,
  onNewChat
}: HeaderBarProps) {
  const getStatusColor = () => {
    switch (connectionStatus) {
      case "connected": return "bg-green-500 animate-pulse";
      case "connecting": return "bg-yellow-500 animate-pulse";
      case "disconnected": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusText = () => {
    return connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1);
  };

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
          <Bot className="text-white" size={16} />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-white">
            AI Agent Framework
          </h1>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 text-xs text-slate-500 dark:text-slate-400">
              <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
              <span>{getStatusText()}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleTheme}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-200"
        >
          {theme === "light" ? (
            <Moon className="text-slate-600 dark:text-slate-400" size={16} />
          ) : (
            <Sun className="text-slate-400" size={16} />
          )}
        </Button>
        
        <Button
          onClick={onNewChat}
          size="sm"
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 flex items-center space-x-2"
        >
          <Plus size={14} />
          <span>New Chat</span>
        </Button>
      </div>
    </header>
  );
}
