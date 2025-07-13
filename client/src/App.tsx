import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import ChatPage from "@/pages/chat";
import GoogleSetup from "@/pages/google-setup";
import GoogleTokenSetup from "@/pages/google-token-setup";
import Home from "@/pages/home";
import AuthPage from "@/pages/auth";

function Router() {
  console.log("Router component rendering");
  const { isAuthenticated, isLoading } = useAuth();
  console.log("Auth state:", { isAuthenticated, isLoading });

  if (isLoading) {
    console.log("Auth is loading, showing spinner");
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/google-setup" component={GoogleSetup} />
      <Route path="/google-token-setup" component={GoogleTokenSetup} />
      {isAuthenticated ? (
        <>
          <Route path="/" component={Home} />
          <Route path="/chat" component={ChatPage} />
          <Route path="/home" component={Home} />
        </>
      ) : (
        <Route path="/" component={AuthPage} />
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  console.log("App component rendering");
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
