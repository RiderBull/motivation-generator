import { NextRequest, NextResponse } from 'next/server';
import { OpenRouter } from '@openrouter/sdk';
// ElevenLabsClient removed


import { getJwtToken } from '@/lib/inworld';

// Initialize Clients
const openRouter = new OpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
});

// Voice IDs
const VOICE_IDS: Record<string, string> = {
    'Steve Jobs': 'w6XKEBjwKfG3SYJoGmil', // "Job"
    // 'Goggins': 'TxGEqnHWrfWFTfGW9XjX', // Unavailable
    'Hormozi': '3DgF8Es1OnVy0iNlx4ap',
    'Bible': 'fCxG8OHm4STbIsWe4aT9',
};

// Prompts for Personas
const PERSONA_PROMPTS: Record<string, string> = {
    'Steve Jobs': 'You are Steve Jobs.',
    'Goggins': 'You are David Goggins.',
    'Hormozi': 'You are Alex Hormozi.',
    'Bible': 'You are a biblical narrator.',
};

export async function POST(req: NextRequest) {
    try {
        const { name, context, persona, previousScripts } = await req.json();

        // Check for Inworld keys instead of ElevenLabs
        if (!process.env.OPENROUTER_API_KEY || !process.env.INWORLD_KEY || !process.env.INWORLD_SECRET) {
            return NextResponse.json({ error: 'Missing API Keys (OpenRouter or Inworld)' }, { status: 500 });
        }

        console.log('--- Start Generation Request ---');
        console.log('Request parameters:', { name, context, persona, hasHistory: !!previousScripts });

        // 1. Generate Script with OpenRouter
        console.log('Using persona:', persona);
        const systemInstruction = PERSONA_PROMPTS[persona] || PERSONA_PROMPTS['Steve Jobs'];

        // Construct Prompt based on history
        let prompt = '';
        if (previousScripts && previousScripts.length > 0) {
            // Infinite Mode Prompt
            const historyText = previousScripts.join('\n\n');
            prompt = `${systemInstruction}\n\nThis is a continuous speech. Here is what has been said so far:\n\n"${historyText}"\n\nContinue the speech for ${name} (max 300 words). You can delve into another subject that's likely to interest the user if you want. Keep outputting the speech only. The user context is: ${context}. Make it punchy and concise (max 300 words). include [Silence] or [Pause] markers when needed. Output one big paragraph, no breakline.`;
        } else {
            // First Prompt
            prompt = `${systemInstruction}\n\nWrite a motivational speech for ${name}. The user context is: ${context}. Use this context to personalize the speech. Make it punchy and concise (max 300 words). include [Silence] or [Pause] markers. Use rethorical techniques to make it super motivational. Just output the speech. Nothing more. Output one big paragraph, no breakline.`;
        }

        console.log('OpenRouter Prompt:', prompt);

        const completion = await openRouter.chat.send({
            model: 'moonshotai/kimi-k2',
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            stream: false,
        });

        let script = "Keep pushing forward.";
        const msgContent = completion?.choices?.[0]?.message?.content;
        if (typeof msgContent === 'string') {
            script = msgContent;
        } else if (Array.isArray(msgContent)) {
            const textPart = msgContent.find(c => c.type === 'text');
            if (textPart && 'text' in textPart) {
                script = textPart.text;
            }
        }
        console.log('Generated Script:', script);

        // 2. Generate Voice with Inworld
        // Use the single requested voice ID for now
        const INWORLD_VOICE_ID = 'default-u2j2nsstbrfdwwjkajopow__job2';

        console.log('Getting Inworld Token...');
        const tokenData = await getJwtToken();

        console.log('Generating Speech with Inworld...');
        const ttsResponse = await fetch('https://api.inworld.ai/tts/v1/voice', {
            method: 'POST',
            headers: {
                'Authorization': `${tokenData.type} ${tokenData.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: `[SLOWLY, DRAMATIC, LONG PAUSES] ${script}`,
                voiceId: INWORLD_VOICE_ID,
                modelId: 'inworld-tts-1-max',
                timestampType: 'WORD',
                temperature: 0.7
            })
        });

        if (!ttsResponse.ok) {
            const errorText = await ttsResponse.text();
            throw new Error(`Inworld TTS API Error: ${ttsResponse.status} ${ttsResponse.statusText} - ${errorText}`);
        }

        const ttsData = await ttsResponse.json();

        if (!ttsData.audioContent) {
            throw new Error('No audio content received from Inworld API');
        }

        // Return Base64 Data URI directly
        // This avoids writing to the filesystem which is read-only on Vercel
        const base64Audio = Buffer.from(ttsData.audioContent, 'base64').toString('base64');
        const audioDataUri = `data:audio/wav;base64,${base64Audio}`;

        return NextResponse.json({
            url: audioDataUri,
            script: script
        });

    } catch (error: any) {
        console.error('Error generating:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
