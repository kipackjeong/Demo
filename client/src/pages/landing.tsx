import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Calendar, ListTodo, Users } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Life Manager AI
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Your intelligent assistant for managing calendars, tasks, and life coordination
          </p>
          <Button
            size="lg"
            onClick={() => window.location.href = "/api/login"}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Get Started
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardHeader>
              <MessageSquare className="h-8 w-8 text-blue-600 mb-2" />
              <CardTitle>Smart Conversations</CardTitle>
              <CardDescription>
                Chat naturally with your AI assistant about your schedule and tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Ask questions, get insights, and receive personalized recommendations for managing your time effectively.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardHeader>
              <Calendar className="h-8 w-8 text-green-600 mb-2" />
              <CardTitle>Calendar Management</CardTitle>
              <CardDescription>
                Intelligent scheduling and appointment coordination
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                View upcoming events, find optimal meeting times, and get scheduling conflict alerts.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardHeader>
              <ListTodo className="h-8 w-8 text-purple-600 mb-2" />
              <CardTitle>Task Organization</CardTitle>
              <CardDescription>
                Smart task prioritization and deadline management
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Track priorities, manage deadlines, and receive actionable insights for better productivity.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg p-8 max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Multi-Agent Intelligence
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Our advanced AI system uses specialized agents that work together to provide comprehensive life management support. Each agent focuses on what it does best, then collaborates to give you the perfect solution.
            </p>
            <div className="flex justify-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Orchestration</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Calendar</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Tasks</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}