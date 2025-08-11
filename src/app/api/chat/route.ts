// src/app/api/chat/route.ts
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OllamaChunk = {
    model?: string;
    message?: { role: 'assistant' | 'user'; content: string };
    done?: boolean;
    error?: string;
};

export async function POST(req: NextRequest) {
    try {
        const { model, messages, options } = await req.json();

        // Llamada a Ollama con streaming
        const upstream = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages,
                options,
                stream: true
            })
        });

        if (!upstream.ok || !upstream.body) {
            const txt = await upstream.text().catch(() => '');
            return new Response(
                JSON.stringify({ error: 'Error al conectar con Ollama', detail: txt }),
                { status: 502, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Transformar NDJSON -> texto plano (sólo los trozos de "content")
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();

        const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
                const reader = upstream.body!.getReader();
                let buffer = '';

                try {
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });

                        // líneas JSON separadas por \n
                        let idx: number;
                        while ((idx = buffer.indexOf('\n')) !== -1) {
                            const line = buffer.slice(0, idx).trim();
                            buffer = buffer.slice(idx + 1);
                            if (!line) continue;

                            try {
                                const chunk = JSON.parse(line) as OllamaChunk;
                                if (chunk.error) {
                                    controller.enqueue(encoder.encode(`⚠️ ${chunk.error}`));
                                    continue;
                                }
                                const piece = chunk.message?.content ?? '';
                                if (piece) controller.enqueue(encoder.encode(piece));
                                if (chunk.done) break;
                            } catch {
                                // ignorar líneas no-JSON
                            }
                        }
                    }
                } catch {
                    controller.enqueue(encoder.encode('⚠️ Error de streaming.'));
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-store'
            }
        });
    } catch {
        return new Response(JSON.stringify({ error: 'Solicitud inválida' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
