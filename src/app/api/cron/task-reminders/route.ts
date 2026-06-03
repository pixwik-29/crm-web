import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; 

// Verify the request came from Vercel Cron or another trusted source if needed.
// For now, we will allow it but in production you'd check a bearer token.

export async function GET(request: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Find tasks that are due, not completed, and haven't had a notification sent
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*, leads(name)')
      .eq('is_completed', false)
      .eq('notification_sent', false)
      .lte('due_date', new Date().toISOString());

    if (tasksError) {
      console.error('[Task Cron] Error fetching tasks:', tasksError);
      return NextResponse.json({ error: tasksError.message }, { status: 500 });
    }

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ message: 'No tasks due right now.' }, { status: 200 });
    }

    console.log(`[Task Cron] Found ${tasks.length} tasks due for notifications.`);

    const notificationsToSend = [];
    const taskIdsToMark: string[] = [];

    // 2. Fetch profiles for the assignees to get their Push Tokens
    for (const task of tasks) {
      if (!task.assignee_id) continue;

      const { data: profile } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('id', task.assignee_id)
        .single();

      if (profile?.push_token && profile.push_token.startsWith('ExponentPushToken')) {
        notificationsToSend.push({
          to: profile.push_token,
          sound: 'default',
          title: '⏰ Task Due Reminder',
          body: `Task: ${task.title}\nLead: ${task.leads?.name || 'Unknown'}`,
          data: { taskId: task.id, leadId: task.lead_id }
        });
        taskIdsToMark.push(task.id);
      }
    }

    // 3. Send Expo Push Notifications
    if (notificationsToSend.length > 0) {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationsToSend)
      });
      const expoData = await response.json();
      console.log('[Task Cron] Expo response:', JSON.stringify(expoData));

      // 4. Mark notifications as sent in the database
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ notification_sent: true })
        .in('id', taskIdsToMark);

      if (updateError) {
        console.error('[Task Cron] Error updating notification_sent flag:', updateError);
      }
    }

    return NextResponse.json({ 
      success: true, 
      tasksProcessed: tasks.length,
      notificationsSent: notificationsToSend.length 
    });

  } catch (err: any) {
    console.error('[Task Cron] Critical Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
