// Mock data store that can be modified during runtime
export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  endTime: string;
  description: string;
  location: string;
  attendees: string[];
  status: "confirmed" | "tentative" | "cancelled";
  priority: "high" | "medium" | "low";
}

export interface Task {
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
}

class MockDataStore {
  private calendarEvents: Map<string, CalendarEvent> = new Map();
  private tasks: Map<string, Task> = new Map();
  private nextEventId: number = 100;
  private nextTaskId: number = 100;

  constructor() {
    this.initializeCalendarData();
    this.initializeTasksData();
  }

  private initializeCalendarData() {
    const initialEvents: CalendarEvent[] = [
      {
        id: "cal_001",
        title: "Team Sprint Planning",
        date: "2025-07-12",
        time: "09:00 AM",
        endTime: "11:00 AM",
        description: "Planning session for Q3 sprint goals and backlog prioritization",
        location: "Conference Room A",
        attendees: ["john@company.com", "sarah@company.com", "mike@company.com"],
        status: "confirmed",
        priority: "high"
      },
      {
        id: "cal_002",
        title: "Doctor Appointment - Annual Checkup",
        date: "2025-07-13",
        time: "2:00 PM",
        endTime: "3:00 PM",
        description: "Annual physical examination with Dr. Smith",
        location: "Medical Center, Suite 204",
        attendees: ["patient@email.com"],
        status: "confirmed",
        priority: "medium"
      },
      {
        id: "cal_003",
        title: "Client Presentation - Q3 Review",
        date: "2025-07-14",
        time: "3:30 PM",
        endTime: "5:00 PM",
        description: "Quarterly business review with ABC Corp client",
        location: "Virtual Meeting (Zoom)",
        attendees: ["client@abccorp.com", "account@company.com"],
        status: "confirmed",
        priority: "high"
      },
      {
        id: "cal_004",
        title: "Lunch with Mom",
        date: "2025-07-15",
        time: "12:30 PM",
        endTime: "2:00 PM",
        description: "Monthly lunch catch-up",
        location: "Italian Bistro downtown",
        attendees: ["mom@family.com"],
        status: "confirmed",
        priority: "medium"
      },
      {
        id: "cal_005",
        title: "Dentist Appointment",
        date: "2025-07-16",
        time: "10:00 AM",
        endTime: "11:00 AM",
        description: "Routine dental cleaning",
        location: "Smile Dental Clinic",
        attendees: ["patient@email.com"],
        status: "confirmed",
        priority: "low"
      },
      {
        id: "cal_006",
        title: "Project Demo - Marketing Team",
        date: "2025-07-17",
        time: "4:00 PM",
        endTime: "5:30 PM",
        description: "Demo new analytics dashboard features",
        location: "Meeting Room B",
        attendees: ["marketing@company.com", "dev@company.com"],
        status: "tentative",
        priority: "medium"
      },
      {
        id: "cal_007",
        title: "Weekend Hiking Trip",
        date: "2025-07-19",
        time: "8:00 AM",
        endTime: "6:00 PM",
        description: "Day hike at Blue Ridge Mountains with friends",
        location: "Blue Ridge Trail Head",
        attendees: ["friends@group.com"],
        status: "confirmed",
        priority: "low"
      },
      {
        id: "cal_008",
        title: "1:1 with Manager",
        date: "2025-07-21",
        time: "2:00 PM",
        endTime: "3:00 PM",
        description: "Monthly check-in and performance review",
        location: "Manager's Office",
        attendees: ["manager@company.com"],
        status: "confirmed",
        priority: "high"
      }
    ];

    initialEvents.forEach(event => {
      this.calendarEvents.set(event.id, event);
    });
  }

  private initializeTasksData() {
    const initialTasks: Task[] = [
      {
        id: "task_001",
        title: "Complete Q3 Project Proposal",
        description: "Finalize the project proposal document for Q3 initiatives including budget analysis and timeline",
        priority: "high",
        dueDate: "2025-07-15",
        completed: false,
        category: "work",
        estimatedTime: "4 hours",
        tags: ["project", "proposal", "Q3"],
        createdDate: "2025-07-01"
      },
      {
        id: "task_002",
        title: "Buy Groceries for Week",
        description: "Weekly grocery shopping: milk, bread, eggs, vegetables, fruits, chicken",
        priority: "medium",
        dueDate: "2025-07-12",
        completed: false,
        category: "personal",
        estimatedTime: "1.5 hours",
        tags: ["shopping", "food", "weekly"],
        createdDate: "2025-07-10"
      },
      {
        id: "task_003",
        title: "Schedule Annual Physical Exam",
        description: "Call Dr. Smith's office to schedule annual physical examination",
        priority: "low",
        dueDate: "2025-07-20",
        completed: true,
        category: "health",
        estimatedTime: "15 minutes",
        tags: ["health", "appointment", "annual"],
        createdDate: "2025-07-05",
        completedDate: "2025-07-11"
      },
      {
        id: "task_004",
        title: "Prepare Marketing Dashboard Demo",
        description: "Create slides and demo script for marketing team presentation",
        priority: "high",
        dueDate: "2025-07-17",
        completed: false,
        category: "work",
        estimatedTime: "3 hours",
        tags: ["presentation", "marketing", "demo"],
        createdDate: "2025-07-08"
      },
      {
        id: "task_005",
        title: "Research Weekend Hiking Gear",
        description: "Look up best hiking boots and backpack for Blue Ridge trip",
        priority: "low",
        dueDate: "2025-07-18",
        completed: false,
        category: "personal",
        estimatedTime: "1 hour",
        tags: ["hiking", "gear", "research"],
        createdDate: "2025-07-09"
      },
      {
        id: "task_006",
        title: "Update Resume with Recent Projects",
        description: "Add Q2 accomplishments and recent project outcomes to resume",
        priority: "medium",
        dueDate: "2025-07-25",
        completed: false,
        category: "career",
        estimatedTime: "2 hours",
        tags: ["resume", "career", "projects"],
        createdDate: "2025-07-03"
      },
      {
        id: "task_007",
        title: "Plan Mom's Birthday Celebration",
        description: "Organize dinner reservation and gift for mom's birthday next month",
        priority: "medium",
        dueDate: "2025-07-30",
        completed: false,
        category: "personal",
        estimatedTime: "2 hours",
        tags: ["birthday", "family", "planning"],
        createdDate: "2025-07-06"
      },
      {
        id: "task_008",
        title: "Submit Expense Reports",
        description: "Complete and submit Q2 expense reports with receipts",
        priority: "high",
        dueDate: "2025-07-13",
        completed: false,
        category: "work",
        estimatedTime: "1 hour",
        tags: ["expenses", "finance", "Q2"],
        createdDate: "2025-07-07"
      },
      {
        id: "task_009",
        title: "Car Oil Change",
        description: "Schedule and complete car oil change at 50,000 miles",
        priority: "medium",
        dueDate: "2025-07-20",
        completed: false,
        category: "personal",
        estimatedTime: "2 hours",
        tags: ["car", "maintenance", "auto"],
        createdDate: "2025-07-04"
      },
      {
        id: "task_010",
        title: "Review Team Performance Reports",
        description: "Review and provide feedback on Q2 team performance reports",
        priority: "high",
        dueDate: "2025-07-14",
        completed: false,
        category: "work",
        estimatedTime: "3 hours",
        tags: ["management", "review", "team"],
        createdDate: "2025-07-02"
      }
    ];

    initialTasks.forEach(task => {
      this.tasks.set(task.id, task);
    });
  }

  // Calendar operations
  getCalendarEvents(): CalendarEvent[] {
    return Array.from(this.calendarEvents.values());
  }

  addCalendarEvent(event: Omit<CalendarEvent, "id">): CalendarEvent {
    const id = `cal_${(++this.nextEventId).toString().padStart(3, "0")}`;
    const newEvent: CalendarEvent = { ...event, id };
    this.calendarEvents.set(id, newEvent);
    return newEvent;
  }

  updateCalendarEvent(id: string, updates: Partial<CalendarEvent>): CalendarEvent | null {
    const event = this.calendarEvents.get(id);
    if (!event) return null;
    
    const updatedEvent = { ...event, ...updates, id: event.id };
    this.calendarEvents.set(id, updatedEvent);
    return updatedEvent;
  }

  deleteCalendarEvent(id: string): boolean {
    return this.calendarEvents.delete(id);
  }

  // Task operations
  getTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  addTask(task: Omit<Task, "id">): Task {
    const id = `task_${(++this.nextTaskId).toString().padStart(3, "0")}`;
    const newTask: Task = { ...task, id };
    this.tasks.set(id, newTask);
    return newTask;
  }

  updateTask(id: string, updates: Partial<Task>): Task | null {
    const task = this.tasks.get(id);
    if (!task) return null;
    
    const updatedTask = { ...task, ...updates, id: task.id };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }

  deleteTask(id: string): boolean {
    return this.tasks.delete(id);
  }

  completeTask(id: string): Task | null {
    const task = this.tasks.get(id);
    if (!task) return null;
    
    const updatedTask = { 
      ...task, 
      completed: true, 
      completedDate: new Date().toISOString().split('T')[0] 
    };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }
}

// Export singleton instance
export const mockDataStore = new MockDataStore();