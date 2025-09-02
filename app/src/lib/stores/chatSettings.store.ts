import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'chat_settings';
const API_KEY_STORAGE = 'gemini_api_key';

export interface ChatSettings {
	useGemini: boolean;
	includeFilteredData: boolean;
}

function createChatSettingsStore() {
	// Load initial settings from localStorage
	const loadSettings = (): ChatSettings => {
		if (!browser) {
			return {
				useGemini: false,
				includeFilteredData: false
			};
		}
		
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				return JSON.parse(stored);
			} catch {
				// Invalid JSON, return defaults
			}
		}
		
		return {
			useGemini: false,
			includeFilteredData: false
		};
	};

	const { subscribe, set, update } = writable<ChatSettings>(loadSettings());

	return {
		subscribe,
		updateSettings: (settings: Partial<ChatSettings>) => {
			update(current => {
				const newSettings = { ...current, ...settings };
				if (browser) {
					localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
				}
				return newSettings;
			});
		},
		reset: () => {
			const defaults = {
				useGemini: false,
				includeFilteredData: false
			};
			set(defaults);
			if (browser) {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
			}
		}
	};
}

// Store for Gemini API key (separate for security)
function createApiKeyStore() {
	const loadKey = (): string => {
		if (!browser) return '';
		return localStorage.getItem(API_KEY_STORAGE) || '';
	};

	const { subscribe, set } = writable<string>(loadKey());

	return {
		subscribe,
		setKey: (key: string) => {
			set(key);
			if (browser) {
				if (key) {
					localStorage.setItem(API_KEY_STORAGE, key);
				} else {
					localStorage.removeItem(API_KEY_STORAGE);
				}
			}
		},
		clearKey: () => {
			set('');
			if (browser) {
				localStorage.removeItem(API_KEY_STORAGE);
			}
		}
	};
}

export const chatSettings = createChatSettingsStore();
export const geminiApiKey = createApiKeyStore();