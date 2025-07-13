import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Calendar, CheckSquare, Users, Zap, Shield } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Life Manager AI
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8">
            Your intelligent personal assistant for managing calendar events, tasks, and daily productivity with AI-powered insights.
          </p>
          <Button 
            onClick={() => window.location.href = '/auth'}
            size="lg"
            className="px-8 py-3 text-lg"
          >
            Get Started
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <Card className="text-center">
            <CardHeader>
              <MessageCircle className="h-12 w-12 mx-auto mb-4 text-blue-600" />
              <CardTitle>AI-Powered Chat</CardTitle>
              <CardDescription>
                Natural language conversations with intelligent responses and context awareness.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Calendar className="h-12 w-12 mx-auto mb-4 text-green-600" />
              <CardTitle>Smart Calendar</CardTitle>
              <CardDescription>
                Seamless Google Calendar integration for scheduling and event management.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <CheckSquare className="h-12 w-12 mx-auto mb-4 text-purple-600" />
              <CardTitle>Task Management</CardTitle>
              <CardDescription>
                Intelligent task organization with Google Tasks integration and priorities.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Users className="h-12 w-12 mx-auto mb-4 text-orange-600" />
              <CardTitle>Multi-Agent System</CardTitle>
              <CardDescription>
                Specialized AI agents for different aspects of life management.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Zap className="h-12 w-12 mx-auto mb-4 text-yellow-600" />
              <CardTitle>Real-Time Sync</CardTitle>
              <CardDescription>
                Instant updates and streaming responses for seamless interaction.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Shield className="h-12 w-12 mx-auto mb-4 text-red-600" />
              <CardTitle>Secure & Private</CardTitle>
              <CardDescription>
                Your data is protected with enterprise-grade security measures.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Ready to Get Started?</CardTitle>
              <CardDescription className="text-lg">
                Join thousands of users who have transformed their productivity with Life Manager AI.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => window.location.href = '/auth'}
                size="lg"
                className="px-8 py-3"
              >
                Get Started
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}