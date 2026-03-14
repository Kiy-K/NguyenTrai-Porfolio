import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text, section } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const apiKey = process.env.MISTRAL_API_KEY;
    
    if (!apiKey || apiKey === 'your_api_key_here') {
      return NextResponse.json(
        { error: 'MISTRAL_API_KEY is not configured in environment variables.' },
        { status: 500 }
      );
    }

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          { 
            role: 'system', 
            content: `You are an AI assistant helping a user write a title for a literature project about the Vietnamese author Nguyễn Trãi.\nThe user is currently typing the title. Based on what they have typed so far, provide 3 creative, academic, and engaging title suggestions in Vietnamese.\nThe project belongs to the category: "${section}".\nReturn ONLY a JSON array of 3 strings. Do not include any markdown formatting, code blocks, or explanations. Just the raw JSON array.\nExample output: ["Bình Ngô Đại Cáo: Khúc tráng ca nhân nghĩa", "Tư tưởng nhân nghĩa trong thơ văn Nguyễn Trãi", "Nguyễn Trãi: Cuộc đời và sự nghiệp"]` 
          },
          { 
            role: 'user', 
            content: `User is typing: "${text}"\nCategory: "${section}"\n\nSuggestions:` 
          }
        ],
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mistral API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content returned from Mistral API');
    }

    try {
      // Try to parse the content as JSON array
      const suggestions = JSON.parse(content);
      if (Array.isArray(suggestions)) {
        return NextResponse.json({ suggestions });
      }
    } catch (e) {
      // If parsing fails, try to extract array from text
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          const suggestions = JSON.parse(match[0]);
          if (Array.isArray(suggestions)) {
            return NextResponse.json({ suggestions });
          }
        } catch (e2) {}
      }
    }

    // Fallback: split by newlines and clean up
    const suggestions = content
      .split('\n')
      .map((line: string) => line.replace(/^[-*0-9.)\s"']+/, '').replace(/["']+$/, '').trim())
      .filter((line: string) => line.length > 0)
      .slice(0, 3);

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error('Mistral API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate title suggestions' }, 
      { status: 500 }
    );
  }
}
