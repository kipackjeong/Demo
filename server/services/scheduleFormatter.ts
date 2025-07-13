/**
 * Schedule Formatter
 * Provides consistent, readable formatting for calendar events and tasks
 */

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  endTime?: string;
  description?: string;
  location?: string;
}

interface Task {
  id: string;
  title: string;
  dueDate?: string;
  priority?: string;
  taskListTitle?: string;
  completed?: boolean;
}

export class ScheduleFormatter {
  /**
   * Format a weekly summary with events and tasks
   */
  static formatWeeklySummary(
    events: CalendarEvent[],
    tasks: Task[],
    timeRange: string = "This Week"
  ): string {
    const sections = [];
    
    // Header
    sections.push(`# 📅 ${timeRange} Overview\n`);
    
    // Calendar Events Section
    if (events && events.length > 0) {
      sections.push("## Calendar Events\n");
      
      // Group events by date
      const eventsByDate = this.groupEventsByDate(events);
      
      for (const [date, dayEvents] of Object.entries(eventsByDate)) {
        sections.push(`### ${this.formatDateHeader(date)}`);
        
        dayEvents.forEach(event => {
          sections.push(this.formatEvent(event));
        });
        
        sections.push(""); // Empty line between days
      }
    } else {
      sections.push("## Calendar Events\n");
      sections.push("*No events scheduled*\n");
    }
    
    // Tasks Section
    if (tasks && tasks.length > 0) {
      sections.push("## Tasks\n");
      
      // Group tasks by priority or list
      const tasksByPriority = this.groupTasksByPriority(tasks);
      
      if (tasksByPriority.high.length > 0) {
        sections.push("### 🔴 High Priority");
        tasksByPriority.high.forEach(task => {
          sections.push(this.formatTask(task));
        });
        sections.push("");
      }
      
      if (tasksByPriority.medium.length > 0) {
        sections.push("### 🟡 Medium Priority");
        tasksByPriority.medium.forEach(task => {
          sections.push(this.formatTask(task));
        });
        sections.push("");
      }
      
      if (tasksByPriority.low.length > 0) {
        sections.push("### 🟢 Low Priority");
        tasksByPriority.low.forEach(task => {
          sections.push(this.formatTask(task));
        });
        sections.push("");
      }
    } else {
      sections.push("## Tasks\n");
      sections.push("*No tasks due*\n");
    }
    
    // Summary Section
    sections.push("## Summary");
    sections.push(`- **Events**: ${events.length} scheduled`);
    sections.push(`- **Tasks**: ${tasks.length} pending`);
    
    return sections.join("\n");
  }
  
  /**
   * Format a single event
   */
  private static formatEvent(event: CalendarEvent): string {
    const parts = [`**${event.title}**`];
    
    if (event.time && event.endTime) {
      parts.push(`⏰ ${event.time} - ${event.endTime}`);
    } else if (event.time) {
      parts.push(`⏰ ${event.time}`);
    }
    
    if (event.location) {
      parts.push(`📍 ${event.location}`);
    }
    
    if (event.description) {
      const shortDesc = event.description.substring(0, 100);
      parts.push(`📝 ${shortDesc}${event.description.length > 100 ? '...' : ''}`);
    }
    
    return "- " + parts.join(" | ");
  }
  
  /**
   * Format a single task
   */
  private static formatTask(task: Task): string {
    const parts = [`**${task.title}**`];
    
    if (task.dueDate) {
      parts.push(`📅 Due: ${this.formatTaskDate(task.dueDate)}`);
    }
    
    if (task.taskListTitle) {
      parts.push(`📂 ${task.taskListTitle}`);
    }
    
    return "- " + parts.join(" | ");
  }
  
  /**
   * Group events by date
   */
  private static groupEventsByDate(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
    const grouped: Record<string, CalendarEvent[]> = {};
    
    events.forEach(event => {
      const date = event.date || "Unknown Date";
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(event);
    });
    
    // Sort dates
    const sortedDates = Object.keys(grouped).sort((a, b) => 
      new Date(a).getTime() - new Date(b).getTime()
    );
    
    const sortedGrouped: Record<string, CalendarEvent[]> = {};
    sortedDates.forEach(date => {
      sortedGrouped[date] = grouped[date];
    });
    
    return sortedGrouped;
  }
  
  /**
   * Group tasks by priority
   */
  private static groupTasksByPriority(tasks: Task[]): {
    high: Task[];
    medium: Task[];
    low: Task[];
  } {
    const grouped = {
      high: [] as Task[],
      medium: [] as Task[],
      low: [] as Task[]
    };
    
    tasks.forEach(task => {
      const priority = task.priority?.toLowerCase() || 'low';
      if (priority === 'high') {
        grouped.high.push(task);
      } else if (priority === 'medium') {
        grouped.medium.push(task);
      } else {
        grouped.low.push(task);
      }
    });
    
    return grouped;
  }
  
  /**
   * Format date header
   */
  private static formatDateHeader(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Check if it's today or tomorrow
      if (date.toDateString() === today.toDateString()) {
        return "Today";
      } else if (date.toDateString() === tomorrow.toDateString()) {
        return "Tomorrow";
      }
      
      // Format as "Monday, July 17"
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      };
      return date.toLocaleDateString('en-US', options);
    } catch {
      return dateStr;
    }
  }
  
  /**
   * Format task date
   */
  private static formatTaskDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      const today = new Date();
      
      // Check if overdue
      if (date < today && date.toDateString() !== today.toDateString()) {
        const daysOverdue = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        return `Overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`;
      }
      
      // Check if it's today
      if (date.toDateString() === today.toDateString()) {
        return "Today";
      }
      
      // Check if it's tomorrow
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (date.toDateString() === tomorrow.toDateString()) {
        return "Tomorrow";
      }
      
      // Format as "Mon, Jul 17"
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      };
      return date.toLocaleDateString('en-US', options);
    } catch {
      return dateStr;
    }
  }
}