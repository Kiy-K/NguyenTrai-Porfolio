import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { query, projects } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
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
            content: `You are an AI search engine for a literature project database.\nGiven a user's search query and a list of projects (with id, title, and description), return a JSON array of project IDs that are RELEVANT to the query.\n- Consider synonyms, related terms, and semantic meaning in Vietnamese.\n- If the query is related to the project's topic, author, or content, include its ID.\n- Return ONLY a JSON array of strings (the IDs). Do not include any markdown formatting, code blocks, or explanations. Just the raw JSON array.\nExample output: ["project-1", "project-3"]` 
          },
          { 
            role: 'user', 
            content: `Query: "${query}"\n\nProjects:\n${JSON.stringify(projects.map((p: any) => ({id: p.id, title: p.title, description: p.description})))}` 
          }
        ],
        temperature: 0.1,
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
      const matchedIds = JSON.parse(content);
      if (Array.isArray(matchedIds)) {
        return NextResponse.json({ matchedIds: matchedIds.map(String) });
      }
    } catch (e) {
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          const matchedIds = JSON.parse(match[0]);
          if (Array.isArray(matchedIds)) {
            return NextResponse.json({ matchedIds: matchedIds.map(String) });
          }
        } catch (e2) {}
      }
    }

    return NextResponse.json({ matchedIds: [] });
  } catch (error: any) {
    console.error('Mistral API Error:', error);
    
    // Check if it's a network error (fetch failed)
    const isNetworkError = error.message?.includes('fetch') || error.cause;
    const errorMessage = isNetworkError 
      ? 'Không thể kết nối đến máy chủ Mistral API. Vui lòng thử lại sau.'
      : (error.message || 'Failed to perform AI search');

    return NextResponse.json(
      { error: errorMessage }, 
      { status: 500 }
    );
  }
}
