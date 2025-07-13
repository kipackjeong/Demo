import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface GoogleAuthWarningProps {
  onReauthorize: () => void;
}

export function GoogleAuthWarning({ onReauthorize }: GoogleAuthWarningProps) {
  return (
    <Alert className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
      <AlertTitle className="text-yellow-800 dark:text-yellow-200">
        Google Calendar & Tasks Integration Needs Attention
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-yellow-700 dark:text-yellow-300">
          To use real Google Calendar and Tasks data, you need to re-authorize access.
          This happens when Google permissions change or expire.
        </p>
        <Button 
          onClick={onReauthorize}
          className="bg-yellow-600 hover:bg-yellow-700 text-white"
          size="sm"
        >
          Re-authorize Google Access
        </Button>
      </AlertDescription>
    </Alert>
  );
}