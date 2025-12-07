/**
 * Inworld JWT Token Generator
 */
import * as crypto from 'crypto';
import { HmacSHA256 } from 'crypto-js';
import axios from 'axios';

// Interfaces
interface ApiKey {
    key: string;
    secret: string;
}

/**
 * JWT Token Response from Inworld API
 */
export interface JwtTokenResponse {
    token: string;
    expirationTime: string;
    type: string;
    sessionId?: string;
}

// Helper functions
function getDateTime(): string {
    const parts = new Date().toISOString().split('T');
    const date = parts[0].replace(/-/g, '');
    const time = parts[1].replace(/:/g, '').substring(0, 6);

    return `${date}${time}`;
}

function getSignatureKey(key: string, params: string[]): string {
    let signature: string | CryptoJS.lib.WordArray = `IW1${key}`;

    params.forEach((p) => {
        signature = HmacSHA256(p, signature);
    });

    return HmacSHA256('iw1_request', signature).toString();
}

function getAuthorization({ host, apiKey, engineHost }: { host: string; apiKey: ApiKey, engineHost: string }): string {
    const { key, secret } = apiKey;
    const path = '/ai.inworld.engine.WorldEngine/GenerateToken';

    const datetime = getDateTime();
    const nonce = crypto.randomBytes(16).toString('hex').slice(1, 12);
    const method = path.substring(1, path.length);

    const signature = getSignatureKey(secret, [
        datetime,
        engineHost.replace(':443', ''),
        method,
        nonce,
    ]);

    return `IW1-HMAC-SHA256 ApiKey=${key},DateTime=${datetime},Nonce=${nonce},Signature=${signature}`;
}

function generateAuthHeader(): string {
    const apiKey: ApiKey = {
        key: process.env.INWORLD_KEY || '',
        secret: process.env.INWORLD_SECRET || '',
    };

    if (!apiKey.key || !apiKey.secret) {
        throw new Error('Missing INWORLD_KEY or INWORLD_SECRET environment variables');
    }

    const host = process.env.INWORLD_HOST || 'api.inworld.ai';
    const engineHost = process.env.INWORLD_ENGINE_HOST || 'api-engine.inworld.ai';
    return getAuthorization({ host, apiKey, engineHost });
}

// API functions
export async function getJwtToken(): Promise<JwtTokenResponse> {
    const host = process.env.INWORLD_HOST || 'api.inworld.ai';
    let authHeader;
    try {
        authHeader = generateAuthHeader();
    } catch (e: any) {
        console.error("Auth Header Generation Error", e);
        throw e;
    }

    const apiKey = process.env.INWORLD_KEY || '';
    const workspaceName = process.env.INWORLD_WORKSPACE || 'workspaces/default-workspace';

    try {
        console.log('Requesting Inworld JWT token...');
        const response = await axios.post<JwtTokenResponse>(
            `https://${host}/auth/v1/tokens/token:generate`,
            {
                key: apiKey,
                resources: [workspaceName]
            },
            {
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                }
            }
        );

        console.log('Inworld information:', {
            host,
            workspaceName,
            apiKeyPrefix: apiKey.substring(0, 4) + '...'
        });

        console.log('Inworld JWT token received successfully');
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Inworld Auth API Error:', error.response?.data || error.message);
        } else {
            console.error('Inworld Auth Error:', error);
        }
        throw error;
    }
}
