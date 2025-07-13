import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { OAuth2Client } from 'google-auth-library';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  endTime: string;
  description: string;
  location?: string;
  attendees: string[];
  status: "confirmed" | "tentative" | "cancelled";
  priority: "high" | "medium" | "low";
}

export interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken?: string;
  accessToken?: string;
}

export class GoogleCalendarMCP {
  private oauth2Client: OAuth2Client;
  private calendar: any;
  private isAuthenticated: boolean = false;

  constructor(config: GoogleCalendarConfig) {
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

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
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

  async listCalendars(): Promise<any[]> {
    if (!this.isAuthenticated) {
      await this.refreshAccessToken();
    }

    try {
      const response = await this.calendar.calendarList.list();
      return response.data.items || [];
    } catch (error) {
      console.error('Error listing calendars:', error);
      throw error;
    }
  }

  async getEvents(calendarId: string = 'primary', timeMin?: string, timeMax?: string): Promise<CalendarEvent[]> {
    if (!this.isAuthenticated) {
      await this.refreshAccessToken();
    }

    try {
      const response = await this.calendar.events.list({
        calendarId,
        timeMin: timeMin || new Date().toISOString(),
        timeMax: timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Next 7 days
        singleEvents: true,
        orderBy: 'startTime',
      });

      return this.formatEvents(response.data.items || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error;
    }
  }

  async createEvent(calendarId: string = 'primary', eventData: {
    title: string;
    description?: string;
    startDateTime: string;
    endDateTime: string;
    location?: string;
    attendees?: string[];
    timeZone?: string;
  }): Promise<CalendarEvent> {
    if (!this.isAuthenticated) {
      await this.refreshAccessToken();
    }

    try {
      const event = {
        summary: eventData.title,
        description: eventData.description || '',
        location: eventData.location || '',
        start: {
          dateTime: eventData.startDateTime,
          timeZone: eventData.timeZone || 'UTC',
        },
        end: {
          dateTime: eventData.endDateTime,
          timeZone: eventData.timeZone || 'UTC',
        },
        attendees: eventData.attendees?.map(email => ({ email })) || [],
      };

      const response = await this.calendar.events.insert({
        calendarId,
        resource: event,
      });

      return this.formatEvent(response.data);
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }

  async updateEvent(calendarId: string = 'primary', eventId: string, eventData: Partial<{
    title: string;
    description: string;
    startDateTime: string;
    endDateTime: string;
    location: string;
    attendees: string[];
    timeZone: string;
  }>): Promise<CalendarEvent> {
    if (!this.isAuthenticated) {
      await this.refreshAccessToken();
    }

    try {
      const updateData: any = {};
      
      if (eventData.title) updateData.summary = eventData.title;
      if (eventData.description) updateData.description = eventData.description;
      if (eventData.location) updateData.location = eventData.location;
      if (eventData.attendees) updateData.attendees = eventData.attendees.map(email => ({ email }));
      
      if (eventData.startDateTime) {
        updateData.start = {
          dateTime: eventData.startDateTime,
          timeZone: eventData.timeZone || 'UTC',
        };
      }
      
      if (eventData.endDateTime) {
        updateData.end = {
          dateTime: eventData.endDateTime,
          timeZone: eventData.timeZone || 'UTC',
        };
      }

      const response = await this.calendar.events.patch({
        calendarId,
        eventId,
        resource: updateData,
      });

      return this.formatEvent(response.data);
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  }

  async deleteEvent(calendarId: string = 'primary', eventId: string): Promise<void> {
    if (!this.isAuthenticated) {
      await this.refreshAccessToken();
    }

    try {
      await this.calendar.events.delete({
        calendarId,
        eventId,
      });
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  }

  private formatEvent(event: any): CalendarEvent {
    const start = event.start?.dateTime || event.start?.date;
    const end = event.end?.dateTime || event.end?.date;
    
    return {
      id: event.id,
      title: event.summary || 'Untitled Event',
      date: start ? new Date(start).toISOString().split('T')[0] : '',
      time: start ? new Date(start).toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      }) : '',
      endTime: end ? new Date(end).toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      }) : '',
      description: event.description || '',
      location: event.location || '',
      attendees: event.attendees?.map((attendee: any) => attendee.email) || [],
      status: event.status === 'confirmed' ? 'confirmed' : 
              event.status === 'tentative' ? 'tentative' : 'cancelled',
      priority: 'medium' // Google Calendar doesn't have priority, so we default to medium
    };
  }

  private formatEvents(events: any[]): CalendarEvent[] {
    return events.map(event => this.formatEvent(event));
  }

  generateAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      include_granted_scopes: true,
      state: 'calendar',
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