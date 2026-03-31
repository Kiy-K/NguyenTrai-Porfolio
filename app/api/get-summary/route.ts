import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

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
                text: `Hãy tóm tắt đoạn văn sau thành 2-3 câu ngắn gọn bằng tiếng Việt, giữ nguyên ý nghĩa chính:\n\n${text}`
              }]
            }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 256 }
          })
        }
      );

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini API returned ${response.status}: ${err}`);
      }

      const data = await response.json();
      const summary = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!summary) throw new Error('No content returned from Gemini');
      return NextResponse.json({ summary });
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
            {
              role: 'system',
              content: 'Bạn là trợ lý AI. Hãy tóm tắt văn bản được cung cấp thành 2-3 câu ngắn gọn bằng tiếng Việt, giữ nguyên ý nghĩa chính. Chỉ trả về bản tóm tắt, không giải thích thêm.'
            },
            { role: 'user', content: text }
          ],
          temperature: 0.4,
          max_tokens: 256
        })
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Mistral API returned ${response.status}: ${err}`);
      }

      const data = await response.json();
      const summary = data.choices?.[0]?.message?.content?.trim();
      if (!summary) throw new Error('No content returned from Mistral');
      return NextResponse.json({ summary });
    }

    return NextResponse.json(
      { error: 'No AI provider configured. Set GEMINI_API_KEY or MISTRAL_API_KEY in environment variables.' },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('get-summary error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
