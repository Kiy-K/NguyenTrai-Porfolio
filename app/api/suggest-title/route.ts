import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = (section: string) =>
  `You are an AI assistant helping a user write a title for a literature project about the Vietnamese author Nguyễn Trãi.
The user is currently typing the title. Based on what they have typed so far, provide 3 creative, academic, and engaging title suggestions in Vietnamese.
The project belongs to the category: "${section}".
Return ONLY a JSON array of 3 strings. Do not include any markdown formatting, code blocks, or explanations. Just the raw JSON array.
Example output: ["Bình Ngô Đại Cáo: Khúc tráng ca nhân nghĩa", "Tư tưởng nhân nghĩa trong thơ văn Nguyễn Trãi", "Nguyễn Trãi: Cuộc đời và sự nghiệp"]`;

function parseSuggestions(content: string): string[] | null {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed.slice(0, 3);
  } catch {
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) return parsed.slice(0, 3);
      } catch {}
    }
  }
  // Fallback: split by newlines
  const lines = content
    .split('\n')
    .map((l) => l.replace(/^[-*0-9.)\s"']+/, '').replace(/["']+$/, '').trim())
    .filter((l) => l.length > 0)
    .slice(0, 3);
  return lines.length > 0 ? lines : null;
}

export async function POST(request: Request) {
  try {
    const { text, section } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const mistralKey = process.env.MISTRAL_API_KEY;

    // Use Gemini if key is available, otherwise fall back to Mistral
    if (geminiKey && geminiKey !== 'your_gemini_api_key_here') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `${SYSTEM_PROMPT(section)}\n\nUser is typing: "${text}"\nCategory: "${section}"\n\nSuggestions:`
              }]
            }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 256 }
          })
        }
      );

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini API returned ${response.status}: ${err}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new Error('No content returned from Gemini');
      const suggestions = parseSuggestions(content);
      if (!suggestions) throw new Error('Could not parse suggestions from Gemini response');
      return NextResponse.json({ suggestions });
    }

    if (mistralKey && mistralKey !== 'your_api_key_here') {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mistralKey}`
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT(section) },
            { role: 'user', content: `User is typing: "${text}"\nCategory: "${section}"\n\nSuggestions:` }
          ],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Mistral API returned ${response.status}: ${err}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('No content returned from Mistral');
      const suggestions = parseSuggestions(content);
      if (!suggestions) throw new Error('Could not parse suggestions from Mistral response');
      return NextResponse.json({ suggestions });
    }

    return NextResponse.json(
      { error: 'No AI provider configured. Set GEMINI_API_KEY or MISTRAL_API_KEY in environment variables.' },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('suggest-title error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate title suggestions' },
      { status: 500 }
    );
  }
}
