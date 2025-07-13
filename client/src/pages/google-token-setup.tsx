import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, CheckCircle } from "lucide-react";

export default function GoogleTokenSetup() {
  const [refreshToken, setRefreshToken] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const updateTokensMutation = useMutation({
    mutationFn: async (token: string) => {
      return await apiRequest("POST", "/api/auth/google/set-refresh-token", { refreshToken: token });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Google refresh token has been set. Redirecting to chat...",
      });
      setTimeout(() => setLocation("/chat"), 1000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (refreshToken.trim()) {
      updateTokensMutation.mutate(refreshToken.trim());
    }
  };

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>Manual Google Token Setup</CardTitle>
          <CardDescription>
            If automatic Google authorization isn't providing a refresh token, you can manually set it here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>How to get your refresh token:</strong>
              <ol className="list-decimal ml-5 mt-2 space-y-1">
                <li>Go to <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google OAuth Playground</a></li>
                <li>In Step 1, select:
                  <ul className="list-disc ml-5">
                    <li>Google Calendar API v3 (all scopes)</li>
                    <li>Tasks API v1 (all scopes)</li>
                  </ul>
                </li>
                <li>Click "Authorize APIs"</li>
                <li>In Step 2, click "Exchange authorization code for tokens"</li>
                <li>Copy the refresh_token value</li>
              </ol>
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="refreshToken">Google Refresh Token</Label>
              <Input
                id="refreshToken"
                type="text"
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                placeholder="1//0gxxxxxxxx..."
                className="font-mono text-sm"
              />
              <p className="text-sm text-muted-foreground mt-1">
                This token allows the app to access your Google Calendar and Tasks
              </p>
            </div>

            <div className="flex gap-4">
              <Button 
                type="submit" 
                disabled={!refreshToken.trim() || updateTokensMutation.isPending}
              >
                {updateTokensMutation.isPending ? "Setting Token..." : "Set Token"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/chat")}
              >
                Back to Chat
              </Button>
            </div>
          </form>

          {updateTokensMutation.isSuccess && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Token successfully set! Redirecting...
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}