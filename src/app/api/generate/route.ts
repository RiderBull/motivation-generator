import { NextRequest, NextResponse } from 'next/server';
import { OpenRouter } from '@openrouter/sdk';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import ffmpeg from 'fluent-ffmpeg';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

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
    'Steve Jobs': 'You are Steve Jobs. Speak with visionary intensity, focus on design, simplicity, and connecting the dots. Be inspiring but calm.',
    'Goggins': 'You are David Goggins. SCREAM at the user (in text, imply intensity). Tell them to stay hard, stop making excuses, and suffer.',
    'Hormozi': 'You are Alex Hormozi. Speak about volume, doing the boring work, leverage, and outworking everyone. Be practical and direct.',
    'Bible': 'You are a biblical narrator. Speak with ancient wisdom, using thou/thee if appropriate, or just grand, poetic, king james style language.',
};

export async function POST(req: NextRequest) {
    try {
        const { name, context, persona, mood } = await req.json();

        if (!process.env.OPENROUTER_API_KEY || !process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY) {
            return NextResponse.json({ error: 'Missing API Keys' }, { status: 500 });
        }

        // 1. Generate Script with OpenRouter
        const systemInstruction = PERSONA_PROMPTS[persona] || PERSONA_PROMPTS['Steve Jobs'];
        const prompt = `${systemInstruction}\n\nWrite a short motivational speech (max 100 words) for ${name}. They are struggling with or working on: ${context}. Make it punchy. Do not include any [Silence] or [Pause] markers, just text.`;

        const completion = await openRouter.chat.send({
            model: 'moonshotai/kimi-k2-thinking',
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
            // Handle array content if necessary, though for text generation it's usually string for these models
            // For simplicity, just join or take first text part. 
            // Actually, the SDK types might suggest it is distinct objects.
            // We'll trust string for now or fallback.
            const textPart = msgContent.find(c => c.type === 'text');
            if (textPart && 'text' in textPart) {
                script = textPart.text;
            }
        }
        console.log('Generated Script:', script);

        // 2. Generate Voice with ElevenLabs
        const elevenLabs = new ElevenLabsClient({ apiKey: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY });
        const voiceId = VOICE_IDS[persona] || VOICE_IDS['Steve Jobs'];
        const audioStream = await elevenLabs.textToDialogue.convert({
            inputs: [{
                text: script,
                voiceId: voiceId,
            }],
            modelId: 'eleven_multilingual_v2',
        });

        // Save temporary voice file
        const tempId = uuidv4();
        const tempDir = path.join(process.cwd(), 'public', 'output', 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const voicePath = path.join(tempDir, `${tempId}_voice.mp3`);
        const fileStream = fs.createWriteStream(voicePath);

        for await (const chunk of audioStream) {
            fileStream.write(chunk);
        }
        fileStream.end();

        await new Promise<void>((resolve) => fileStream.on('finish', () => resolve()));

        // 3. Pick Music
        // Map 'Motivational' -> 'focus' folder, 'Emotional' -> 'emotional' folder
        const moodFolder = mood === 'Motivational' ? 'focus' : 'emotional';
        const musicDir = path.join(process.cwd(), 'playlists', moodFolder);
        let musicFile = '';

        if (fs.existsSync(musicDir)) {
            const files = fs.readdirSync(musicDir).filter(f => f.endsWith('.mp3'));
            if (files.length > 0) {
                musicFile = path.join(musicDir, files[Math.floor(Math.random() * files.length)]);
            }
        }

        // 4. Mix Audio
        const outputPath = path.join(process.cwd(), 'public', 'output', `${tempId}_final.mp3`);

        if (musicFile) {
            await new Promise<void>((resolve, reject) => {
                ffmpeg()
                    .input(musicFile)
                    .inputOption('-stream_loop -1') // Loop music
                    .input(voicePath)
                    .complexFilter('[0:a][1:a]amix=inputs=2:duration=shortest[out]')
                    .map('[out]')
                    .on('end', () => resolve())
                    .on('error', (err) => reject(err))
                    .save(outputPath);
            });
        } else {
            // If no music, just copy voice to output
            fs.copyFileSync(voicePath, outputPath);
        }

        // Cleanup temp voice
        // fs.unlinkSync(voicePath); // Keep for debugging if needed, or delete

        return NextResponse.json({
            url: `/output/${tempId}_final.mp3`,
            script: script
        });

    } catch (error: any) {
        console.error('Error generating:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
