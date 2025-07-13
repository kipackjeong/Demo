import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface GoogleAuthWarningProps {
  onReauthorize: () => void;
}

export function GoogleAuthWarning({ onReauthorize }: GoogleAuthWarningProps) {
  const [isRevoking, setIsRevoking] = useState(false);
  const { toast } = useToast();

  const handleRevokeAndReauthorize = async () => {
    setIsRevoking(true);
    try {
      // First revoke existing Google access
      await apiRequest("POST", "/api/auth/google/revoke");
      
      toast({
        title: "Google access revoked",
        description: "Redirecting to Google for fresh authorization...",
      });
      
      // Wait a moment then redirect to Google OAuth with force consent
      setTimeout(() => {
        window.location.href = "/api/auth/google?force=true";
      }, 1000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to revoke Google access. Please try again.",
        variant: "destructive",
      });
      setIsRevoking(false);
    }
  };

  return (
    <Alert className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
      <AlertTitle className="text-yellow-800 dark:text-yellow-200">
        Google Calendar & Tasks Integration Needs Attention
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-yellow-700 dark:text-yellow-300">
          To use real Google Calendar and Tasks data, you need to re-authorize access.
          We'll revoke the current access and get fresh permissions.
        </p>
        <div className="flex gap-2">
          <Button 
            onClick={handleRevokeAndReauthorize}
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
            size="sm"
            disabled={isRevoking}
          >
            {isRevoking ? "Revoking..." : "Revoke & Re-authorize"}
          </Button>
          <Button 
            onClick={onReauthorize}
            variant="outline"
            size="sm"
            disabled={isRevoking}
          >
            Try Again Without Revoking
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}