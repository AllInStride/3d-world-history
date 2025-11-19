import { NextRequest, NextResponse } from 'next/server';
import { Valyu } from 'valyu-js';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const LocationImageSelectionSchema = z.object({
  selectedImageIndices: z.array(z.number()).describe('Array of image indices to select (0-based), ordered by preference. Select 2-4 images.'),
  reasoning: z.string().describe('Brief explanation of why these images were selected'),
});

async function filterValidImageUrls(urls: string[]): Promise<string[]> {
  const validUrls: string[] = [];

  for (const url of urls) {
    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        continue;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ImageValidator/1.0)',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.startsWith('image/')) {
          validUrls.push(url);
        }
      }
    } catch {
      continue;
    }
  }

  return validUrls;
}

export async function POST(req: NextRequest) {
  try {
    const { locationName, historicalPeriod, preset } = await req.json();

    // Check API keys
    const valyuApiKey = process.env.VALYU_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      console.log('[LocationImage] OpenAI API key not configured');
      return NextResponse.json({ images: [], source: 'none', reason: 'OpenAI API key not configured' });
    }

    if (!valyuApiKey) {
      console.log('[LocationImage] Valyu API key not configured');
      return NextResponse.json({ images: [], source: 'none', reason: 'Valyu API key not configured' });
    }

    // Step 1: Generate optimized search query
    let searchQuery: string;

    try {
      const queryResult = await generateObject({
        model: openai('gpt-5'),
        messages: [
          {
            role: 'user',
            content: `Generate a short search query (MAX 3-5 words) for finding images of a location.

Location: ${locationName}
${historicalPeriod ? `Period: ${historicalPeriod}` : ''}
${preset ? `Topic: ${preset}` : ''}

Examples:
- "Paris Eiffel Tower"
- "Rome Colosseum"
- "Russia Ukraine war"
- "Norway fjords"

Return ONLY the short search query (3-5 words max).`,
          },
        ],
        schema: z.object({
          searchQuery: z.string().describe('Short search query (3-5 words)'),
        }) as any,
      });

      searchQuery = (queryResult.object as any).searchQuery;
      console.log('[LocationImage] Optimized query:', searchQuery);
    } catch (error) {
      console.error('[LocationImage] Failed to generate query:', error);
      return NextResponse.json({ images: [], source: 'none', reason: 'Failed to generate query' });
    }

    // Step 2: Search Valyu API
    try {
      const valyu = new Valyu(valyuApiKey, 'https://api.valyu.ai/v1');
      const response = await valyu.search(searchQuery, { maxNumResults: 10 });

      if (!response || !response.results || response.results.length === 0) {
        console.log('[LocationImage] No results from Valyu');
        return NextResponse.json({ images: [], source: 'none', reason: 'No search results' });
      }

      // Extract image URLs
      const imageUrls: string[] = [];
      response.results.forEach((result: any) => {
        if (result.image_url && typeof result.image_url === 'object') {
          Object.values(result.image_url).forEach((url) => {
            if (typeof url === 'string' && url.trim()) {
              imageUrls.push(url);
            }
          });
        }
      });

      console.log('[LocationImage] Found', imageUrls.length, 'images from Valyu');

      if (imageUrls.length === 0) {
        return NextResponse.json({ images: [], source: 'none', reason: 'No image URLs in results' });
      }

      // Step 3: Validate URLs
      const validUrls = await filterValidImageUrls(imageUrls);
      console.log('[LocationImage] Validated', validUrls.length, 'images');

      if (validUrls.length === 0) {
        return NextResponse.json({ images: [], source: 'none', reason: 'No valid image URLs' });
      }

      // Step 4: AI-powered image selection
      let result;
      let selectedUrls = validUrls.slice(0, 10);

      try {
        result = await generateObject({
          model: openai('gpt-5'),
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Select 2-4 images that are related to: ${locationName}

${preset ? `Topic focus: ${preset}` : ''}

Be VERY LENIENT - accept most images that show:
- The location or region
- Related landmarks, buildings, or scenery
- Historical or modern views
- People, culture, or events from the area

Only reject if:
- Completely unrelated location
- Extremely low quality/broken

Select as many relevant images as possible (2-4). Return indices (0-based).`,
                },
                ...selectedUrls.map((url) => ({
                  type: 'image' as const,
                  image: url,
                })),
              ],
            },
          ],
          schema: LocationImageSelectionSchema as any,
        });
      } catch (error: any) {
        // If image download fails, try without AI selection - just return first 3 valid images
        console.error('[LocationImage] AI selection failed:', error.message);
        console.log('[LocationImage] Falling back to first 3 images');

        return NextResponse.json({
          images: validUrls.slice(0, 3),
          source: 'valyu',
          reasoning: 'Automatic selection (AI unavailable)',
        });
      }

      const selection = result.object as any;

      // Accept images even if not "perfect" - just need some relevant content
      if (!selection || selection.selectedImageIndices.length === 0) {
        console.log('[LocationImage] No images selected:', selection?.reasoning);
        return NextResponse.json({ images: [], source: 'none', reason: selection?.reasoning || 'No images selected' });
      }

      // Get selected images
      const selectedImages = selection.selectedImageIndices
        .filter((idx: number) => idx >= 0 && idx < validUrls.length)
        .map((idx: number) => validUrls[idx]);

      console.log('[LocationImage] Selected', selectedImages.length, 'images');
      console.log('[LocationImage] Reasoning:', selection.reasoning);

      return NextResponse.json({
        images: selectedImages,
        source: 'valyu',
        reasoning: selection.reasoning,
      });
    } catch (error: any) {
      console.error('[LocationImage] Valyu error:', error);
      return NextResponse.json({ images: [], source: 'none', reason: error.message || 'Valyu API error' });
    }
  } catch (error: any) {
    console.error('[LocationImage] Error:', error);
    return NextResponse.json({ images: [], source: 'none', reason: error.message || 'Unknown error' });
  }
}
