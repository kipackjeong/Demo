import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink, Copy, CheckCircle, AlertCircle } from 'lucide-react';

interface SetupResponse {
  message: string;
  calendarAuthUrl: string;
  tasksAuthUrl: string;
  redirectUri: string;
  setupInstructions: {
    step1: string;
    step2: string;
    step3: string;
    step4: string;
    step5: string;
    step6: string;
    step7: string;
    step8: string;
  };
}

export default function GoogleSetup() {
  const [setupData, setSetupData] = useState<SetupResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  const handleGetSetup = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/google/setup');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get setup data');
      }
      
      setSetupData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/google/test');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to test connection');
      }
      
      setTestResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Google API Setup</h1>
        <p className="text-muted-foreground">
          Connect your Life Manager AI to Google Calendar and Google Tasks
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step 1: Get Setup Information</CardTitle>
          <CardDescription>
            Generate authentication URLs and get setup instructions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleGetSetup} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Getting Setup Data...' : 'Get Setup Instructions'}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {setupData && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Google Cloud Console Setup</CardTitle>
              <CardDescription>
                Follow these steps to configure your Google Cloud project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(setupData.setupInstructions).map(([key, value]) => (
                <div key={key} className="flex items-start space-x-3">
                  <Badge variant="outline" className="mt-1">
                    {key.replace('step', '')}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-sm">{value}</p>
                    {key === 'step6' && (
                      <div className="mt-2 p-2 bg-muted rounded font-mono text-sm">
                        {setupData.redirectUri}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(setupData.redirectUri)}
                          className="ml-2"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Step 3: OAuth Authentication</CardTitle>
              <CardDescription>
                Click these links to authorize access to your Google accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Google Calendar Access</h4>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(setupData.calendarAuthUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Authorize Calendar Access
                  </Button>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Google Tasks Access</h4>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(setupData.tasksAuthUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Authorize Tasks Access
                  </Button>
                </div>
              </div>
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  After clicking each authorization link, you'll be redirected back to this domain with token information. 
                  Copy the provided tokens and add them to your environment variables.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Step 4: Test Connection</CardTitle>
              <CardDescription>
                Once you've added the tokens, test your Google API connection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleTestConnection} 
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Testing Connection...' : 'Test Google API Connection'}
              </Button>
              
              {testResult && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <h4 className="font-medium text-green-800">Connection Successful!</h4>
                  </div>
                  <div className="mt-2 text-sm text-green-700">
                    <p>Found {testResult.calendars} calendars and {testResult.taskLists} task lists</p>
                    {testResult.calendarNames && (
                      <p>Calendars: {testResult.calendarNames.join(', ')}</p>
                    )}
                    {testResult.taskListNames && (
                      <p>Task Lists: {testResult.taskListNames.join(', ')}</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}