import { ImageResponse } from 'next/og';
import * as db from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    // Fetch the research task
    const { data: task } = await db.getPublicResearchTask(token);

    if (!task) {
      throw new Error('Task not found');
    }

    const locationName = task.locationName || task.location_name || 'Unknown Location';

    // Read the base history.png image
    const imagePath = path.join(process.cwd(), 'public', 'history.png');
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            position: 'relative',
          }}
        >
          {/* Background Image */}
          <img
            src={base64Image}
            alt="Background"
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />

          {/* Location Name - Top Left with semi-transparent background */}
          <div
            style={{
              position: 'absolute',
              top: 60,
              left: 60,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              maxWidth: '1000px',
            }}
          >
            <div
              style={{
                fontSize: 64,
                fontWeight: 'bold',
                color: 'white',
                lineHeight: 1.2,
                textShadow: '0 4px 12px rgba(0, 0, 0, 0.5), 0 2px 4px rgba(0, 0, 0, 0.3)',
                background: 'linear-gradient(90deg, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0))',
                padding: '12px 24px',
                borderRadius: '8px',
              }}
            >
              {locationName}
            </div>
            <div
              style={{
                fontSize: 28,
                color: 'rgba(255, 255, 255, 0.95)',
                fontWeight: '500',
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
                background: 'linear-gradient(90deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0))',
                padding: '8px 24px',
                borderRadius: '6px',
              }}
            >
              Historical Research
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    // Fallback image if task not found - read base image
    try {
      const imagePath = path.join(process.cwd(), 'public', 'history.png');
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

      return new ImageResponse(
        (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              position: 'relative',
            }}
          >
            <img
              src={base64Image}
              alt="Background"
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
        ),
        {
          width: 1200,
          height: 630,
        }
      );
    } catch (fallbackError) {
      // Final fallback - purple gradient
      return new ImageResponse(
        (
          <div
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            <div
              style={{
                fontSize: 72,
                fontWeight: 'bold',
                color: 'white',
                textAlign: 'center',
              }}
            >
              History
            </div>
            <div
              style={{
                fontSize: 32,
                color: 'rgba(255, 255, 255, 0.9)',
                marginTop: '20px',
                textAlign: 'center',
              }}
            >
              Discover the stories behind every place on Earth
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 630,
        }
      );
    }
  }
}
