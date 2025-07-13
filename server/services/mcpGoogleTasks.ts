import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleTask {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  dueDate: string;
  completed: boolean;
  category: string;
  estimatedTime: string;
  tags: string[];
  createdDate: string;
  completedDate?: string;
  taskListId: string;
  taskListTitle: string;
}

export interface GoogleTasksConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken?: string;
  accessToken?: string;
}

export class GoogleTasksMCP {
  private oauth2Client: OAuth2Client;
  private tasks: any;
  private isAuthenticated: boolean = false;

  constructor(config: GoogleTasksConfig) {
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );

    if (config.refreshToken) {
      this.oauth2Client.setCredentials({
        refresh_token: config.refreshToken,
        access_token: config.accessToken,
      });
      this.isAuthenticated = true;
    }

    this.tasks = google.tasks({ version: 'v1', auth: this.oauth2Client });
  }

  async refreshAccessToken(): Promise<void> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
      this.isAuthenticated = true;
    } catch (error) {
      console.error('Failed to refresh access token:', error);
      this.isAuthenticated = false;
      throw error;
    }
  }

  async getTaskLists(): Promise<any[]> {
    if (!this.isAuthenticated) {
      await this.refreshAccessToken();
    }

    try {
      const response = await this.tasks.tasklists.list();
      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching task lists:', error);
      throw error;
    }
  }

  async getTasks(taskListId?: string): Promise<GoogleTask[]> {
    if (!this.isAuthenticated) {
      await this.refreshAccessToken();
    }

    try {
      const taskLists = taskListId ? [{ id: taskListId }] : await this.getTaskLists();
      const allTasks: GoogleTask[] = [];

      for (const taskList of taskLists) {
        const response = await this.tasks.tasks.list({
          tasklist: taskList.id,
          showCompleted: true,
          showHidden: true,
        });

        const tasks = response.data.items || [];
        const formattedTasks = tasks.map((task: any) => this.formatTask(task, taskList.id, taskList.title));
        allTasks.push(...formattedTasks);
      }

      return allTasks;
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  }

  async createTask(taskListId: string, taskData: {
    title: string;
    description?: string;
    dueDate?: string;
    priority?: "high" | "medium" | "low";
  }): Promise<GoogleTask> {
    if (!this.isAuthenticated) {
      await this.refreshAccessToken();
    }

    try {
      const task = {
        title: taskData.title,
        notes: taskData.description || '',
        due: taskData.dueDate ? new Date(taskData.dueDate).toISOString() : undefined,
      };

      const response = await this.tasks.tasks.insert({
        tasklist: taskListId,
        resource: task,
      });

      // Get the task list title
      const taskLists = await this.getTaskLists();
      const taskList = taskLists.find(tl => tl.id === taskListId);
      
      return this.formatTask(response.data, taskListId, taskList?.title || 'Default');
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  async updateTask(taskListId: string, taskId: string, taskData: Partial<{
    title: string;
    description: string;
    dueDate: string;
    completed: boolean;
  }>): Promise<GoogleTask> {
    if (!this.isAuthenticated) {
      await this.refreshAccessToken();
    }

    try {
      const updateData: any = {};
      
      if (taskData.title) updateData.title = taskData.title;
      if (taskData.description) updateData.notes = taskData.description;
      if (taskData.dueDate) updateData.due = new Date(taskData.dueDate).toISOString();
      if (taskData.completed !== undefined) {
        updateData.status = taskData.completed ? 'completed' : 'needsAction';
        if (taskData.completed) {
          updateData.completed = new Date().toISOString();
        }
      }

      const response = await this.tasks.tasks.patch({
        tasklist: taskListId,
        task: taskId,
        resource: updateData,
      });

      // Get the task list title
      const taskLists = await this.getTaskLists();
      const taskList = taskLists.find(tl => tl.id === taskListId);
      
      return this.formatTask(response.data, taskListId, taskList?.title || 'Default');
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  async deleteTask(taskListId: string, taskId: string): Promise<void> {
    if (!this.isAuthenticated) {
      await this.refreshAccessToken();
    }

    try {
      await this.tasks.tasks.delete({
        tasklist: taskListId,
        task: taskId,
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }

  async completeTask(taskListId: string, taskId: string): Promise<GoogleTask> {
    return this.updateTask(taskListId, taskId, { completed: true });
  }

  private formatTask(task: any, taskListId: string, taskListTitle: string): GoogleTask {
    const dueDate = task.due ? new Date(task.due).toISOString().split('T')[0] : '';
    const createdDate = task.created ? new Date(task.created).toISOString().split('T')[0] : '';
    const completedDate = task.completed ? new Date(task.completed).toISOString().split('T')[0] : undefined;
    
    return {
      id: task.id,
      title: task.title || 'Untitled Task',
      description: task.notes || '',
      priority: this.inferPriorityFromTitle(task.title) || 'medium',
      dueDate,
      completed: task.status === 'completed',
      category: this.inferCategoryFromTaskList(taskListTitle),
      estimatedTime: '1 hour', // Google Tasks doesn't have estimated time
      tags: this.extractTagsFromDescription(task.notes || ''),
      createdDate,
      completedDate,
      taskListId,
      taskListTitle
    };
  }

  private inferPriorityFromTitle(title: string): "high" | "medium" | "low" {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('urgent') || titleLower.includes('important') || titleLower.includes('asap')) {
      return 'high';
    } else if (titleLower.includes('low') || titleLower.includes('someday') || titleLower.includes('maybe')) {
      return 'low';
    }
    return 'medium';
  }

  private inferCategoryFromTaskList(taskListTitle: string): string {
    const titleLower = taskListTitle.toLowerCase();
    if (titleLower.includes('work') || titleLower.includes('job') || titleLower.includes('office')) {
      return 'work';
    } else if (titleLower.includes('personal') || titleLower.includes('home')) {
      return 'personal';
    } else if (titleLower.includes('health') || titleLower.includes('medical')) {
      return 'health';
    } else if (titleLower.includes('shopping') || titleLower.includes('groceries')) {
      return 'shopping';
    }
    return 'personal';
  }

  private extractTagsFromDescription(description: string): string[] {
    const tagPattern = /#(\w+)/g;
    const tags: string[] = [];
    let match;
    
    while ((match = tagPattern.exec(description)) !== null) {
      tags.push(match[1]);
    }
    
    return tags;
  }

  generateAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/tasks',
      'https://www.googleapis.com/auth/tasks.readonly'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      include_granted_scopes: true,
      state: 'tasks',
    });
  }

  async handleAuthCallback(code: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      this.isAuthenticated = true;

      return {
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || ''
      };
    } catch (error) {
      console.error('Error handling auth callback:', error);
      throw error;
    }
  }
}