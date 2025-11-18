// Polling endpoint for long-running research tasks
// This endpoint can be called repeatedly from the client to check task status

import * as db from '@/lib/db';
import { isDevelopmentMode } from '@/lib/local-db/local-auth';

const DEEPRESEARCH_API_URL = 'https://api.valyu.ai/v1/deepresearch';
const DEEPRESEARCH_API_KEY = process.env.VALYU_API_KEY;

export const maxDuration = 60; // Short timeout for polling endpoint

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return new Response(
        JSON.stringify({ error: 'Missing taskId parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const isDevelopment = isDevelopmentMode();

    // Fetch task status from DeepResearch API
    const statusResponse = await fetch(
      `${DEEPRESEARCH_API_URL}/tasks/${taskId}/status`,
      {
        headers: {
          'X-API-Key': DEEPRESEARCH_API_KEY!,
        },
      }
    );

    if (!statusResponse.ok) {
      throw new Error('Failed to get task status');
    }

    const statusData = await statusResponse.json();

    // Update database status based on DeepResearch API status
    if (!isDevelopment) {
      try {
        if (statusData.status === 'running') {
          await db.updateResearchTaskByDeepResearchId(taskId, {
            status: 'running',
          });
        } else if (statusData.status === 'completed') {
          await db.updateResearchTaskByDeepResearchId(taskId, {
            status: 'completed',
            completed_at: new Date(),
          });
        } else if (statusData.status === 'failed') {
          await db.updateResearchTaskByDeepResearchId(taskId, {
            status: 'failed',
            completed_at: new Date(),
          });
        }
      } catch (error) {
        console.error('[Poll API] Failed to update database status:', error);
        // Don't fail the request if database update fails
      }
    }

    return new Response(
      JSON.stringify(statusData),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('[Poll API] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
