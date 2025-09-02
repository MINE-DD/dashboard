<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import MaterialSymbolsClose from '~icons/material-symbols/close';
	import MaterialSymbolsSend from '~icons/material-symbols/send';
	import MaterialSymbolsSmartToy from '~icons/material-symbols/smart-toy';
	import MaterialSymbolsPerson from '~icons/material-symbols/person';
	import MaterialSymbolsAdd from '~icons/material-symbols/add';
	import MaterialSymbolsSettings from '~icons/material-symbols/settings';
	import MaterialSymbolsDataset from '~icons/material-symbols/dataset';
	import { browser } from '$app/environment';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import ChatSettings from './ChatSettings.svelte';
	import { chatSettings, geminiApiKey } from '$lib/stores/chatSettings.store';
	import { GeminiService } from '$lib/services/gemini.service';
	import { 
		selectedPathogens, 
		selectedAgeGroups, 
		selectedSyndromes,
		filteredPointsData,
		ageGroupValToLab,
		syndromeValToLab
	} from '$lib/stores/filter.store';
	import { pointsData } from '$lib/stores/data.store';

	const dispatch = createEventDispatcher();

	// Chat API configuration
	const CHAT_API_URL = browser ? 'http://localhost:4040' : 'http://chat-backend:4040';
	
	// Gemini service instance
	let geminiService: GeminiService | null = null;
	let showSettings = $state(false);
	let currentSettings = $state({ useGemini: false, includeFilteredData: false });
	let currentApiKey = $state('');

	// Generate a session ID for this chat instance (persisted in localStorage)
	const STORAGE_KEY = 'chatbot_session_id';
	const MESSAGES_STORAGE_KEY = 'chatbot_messages';
	
	// Get or create session ID
	const getOrCreateSessionId = () => {
		if (!browser) return crypto.randomUUID();
		let storedId = localStorage.getItem(STORAGE_KEY);
		if (!storedId) {
			storedId = crypto.randomUUID();
			localStorage.setItem(STORAGE_KEY, storedId);
		}
		return storedId;
	};
	
	const sessionId = getOrCreateSessionId();

	let messageInput = $state('');
	let messages = $state([]);
	let isTyping = $state(false);
	let chatContainer: HTMLElement;
	let isLoading = $state(true);
	
	// Subscribe to settings and API key
	$effect(() => {
		if (browser) {
			const unsubSettings = chatSettings.subscribe(settings => {
				currentSettings = settings;
			});
			
			const unsubKey = geminiApiKey.subscribe(key => {
				currentApiKey = key;
				if (key) {
					geminiService = new GeminiService(key);
				} else {
					geminiService = null;
				}
			});
			
			return () => {
				unsubSettings();
				unsubKey();
			};
		}
	});

	// Save messages to localStorage whenever they change
	$effect(() => {
		if (browser && messages.length > 0) {
			localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
		}
	});

	// Load initial messages when component mounts
	$effect(() => {
		if (browser) {
			loadMessages();
		}
	});

	function closeModal() {
		dispatch('close');
	}

	async function loadMessages() {
		try {
			// First, try to load from localStorage
			const storedMessages = localStorage.getItem(MESSAGES_STORAGE_KEY);
			if (storedMessages) {
				const parsedMessages = JSON.parse(storedMessages);
				messages = parsedMessages.map((msg: any) => ({
					...msg,
					timestamp: new Date(msg.timestamp)
				}));
				isLoading = false;
				return; // Use stored messages and skip API call
			}

			// If no stored messages, try to load from API
			const response = await fetch(`${CHAT_API_URL}/chat/${sessionId}/messages`);
			if (response.ok) {
				const apiMessages = await response.json();
				messages = apiMessages.map((msg: any) => ({
					id: msg.id,
					type: msg.type,
					content: msg.content,
					timestamp: new Date(msg.timestamp)
				}));
			} else {
				// If API fails, set default welcome message with markdown example
				messages = [
					{
						id: 'welcome-1',
						type: 'bot',
						content: `# Welcome to MINE-DD 🌍

I'm your AI assistant for epidemiological data analysis.

**Ask me about:**
- Disease prevalence and trends
- Risk factors by age and region  
- Pathogen distribution patterns
- Public health interventions

> **Tip:** Enable "Include filtered data" in settings to analyze your specific data selection.`,
						timestamp: new Date()
					}
				];
			}
		} catch (error) {
			console.error('Failed to load messages:', error);
			// Check if we have stored messages as fallback
			const storedMessages = localStorage.getItem(MESSAGES_STORAGE_KEY);
			if (storedMessages) {
				const parsedMessages = JSON.parse(storedMessages);
				messages = parsedMessages.map((msg: any) => ({
					...msg,
					timestamp: new Date(msg.timestamp)
				}));
			} else {
				// Fallback to default message with markdown example if no stored messages and API fails
				messages = [
					{
						id: 'fallback-1',
						type: 'bot',
						content: `# Welcome to MINE-DD 🌍

I'm your AI assistant for epidemiological data analysis.

**Ask me about:**
- Disease prevalence and trends
- Risk factors by age and region  
- Pathogen distribution patterns
- Public health interventions

> **Tip:** Enable "Include filtered data" in settings to analyze your specific data selection.`,
						timestamp: new Date()
					}
				];
			}
		} finally {
			isLoading = false;
		}
	}

	function getDataContext() {
		if (!currentSettings.includeFilteredData) return null;
		
		const ageLabels = new Map<string, string>();
		const syndromeLabels = new Map<string, string>();
		
		// Convert VAL to LAB for display
		$selectedAgeGroups.forEach(val => {
			const lab = $ageGroupValToLab.get(val);
			if (lab) ageLabels.set(val, lab);
		});
		
		$selectedSyndromes.forEach(val => {
			const lab = $syndromeValToLab.get(val);
			if (lab) syndromeLabels.set(val, lab);
		});
		
		return {
			pathogens: $selectedPathogens,
			ageGroups: new Set(Array.from(ageLabels.values())),
			syndromes: new Set(Array.from(syndromeLabels.values())),
			totalPoints: $pointsData.features.length,
			filteredPoints: $filteredPointsData.features.length
		};
	}

	async function sendMessage() {
		if (!messageInput.trim()) return;

		const userMessageContent = messageInput.trim();
		messageInput = '';

		// Add user message immediately to UI
		const userMessage = {
			id: `user-${Date.now()}`,
			type: 'user',
			content: userMessageContent,
			timestamp: new Date()
		};

		messages = [...messages, userMessage];
		isTyping = true;

		// Scroll to bottom
		setTimeout(() => {
			if (chatContainer) {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}
		}, 10);

		try {
			let botResponseContent = '';
			
			// Check if we should use Gemini
			if (currentSettings.useGemini && geminiService && geminiService.isInitialized()) {
				// Use Gemini API
				let dataContextString = '';
				
				if (currentSettings.includeFilteredData) {
					const context = getDataContext();
					if (context) {
						dataContextString = geminiService.formatDataContext($filteredPointsData, context);
					}
				}
				
				// Get conversation history (last 10 messages for context)
				const conversationHistory = messages.slice(-10).map(msg => ({
					role: msg.type === 'user' ? 'user' : 'assistant',
					content: msg.content
				}));
				
				botResponseContent = await geminiService.sendMessage(
					userMessageContent,
					dataContextString,
					conversationHistory
				);
			} else {
				// Use existing backend API
				const response = await fetch(`${CHAT_API_URL}/chat/${sessionId}/message`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						content: userMessageContent,
						timestamp: new Date().toISOString()
					})
				});

				if (response.ok) {
					const botResponse = await response.json();
					botResponseContent = botResponse.content;
				} else {
					throw new Error('Failed to send message to backend');
				}
			}
			
			// Add bot response to messages
			const botMessage = {
				id: `bot-${Date.now()}`,
				type: 'bot',
				content: botResponseContent,
				timestamp: new Date()
			};
			messages = [...messages, botMessage];
			
		} catch (error) {
			console.error('Failed to send message:', error);
			// Fallback response if API fails
			const fallbackMessage = {
				id: `fallback-${Date.now()}`,
				type: 'bot',
				content: error instanceof Error ? 
					`Error: ${error.message}` : 
					"I'm sorry, I'm having trouble processing your request right now. Please try again later.",
				timestamp: new Date()
			};
			messages = [...messages, fallbackMessage];
		} finally {
			isTyping = false;
			// Scroll to bottom again
			setTimeout(() => {
				if (chatContainer) {
					chatContainer.scrollTop = chatContainer.scrollHeight;
				}
			}, 10);
		}
	}

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}

	function formatTime(date: Date) {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function renderMarkdown(content: string): string {
		if (!browser) return content;
		// Configure marked options for better formatting
		marked.setOptions({
			breaks: true,
			gfm: true
		});
		const html = marked(content);
		// Sanitize HTML to prevent XSS attacks
		return DOMPurify.sanitize(html);
	}

	function clearConversation() {
		if (browser) {
			// Clear localStorage
			localStorage.removeItem(MESSAGES_STORAGE_KEY);
			localStorage.removeItem(STORAGE_KEY);
			
			// Reset messages to welcome message with markdown example
			messages = [
				{
					id: 'welcome-new',
					type: 'bot',
					content: `# Welcome to MINE-DD 🌍

I'm your AI assistant for epidemiological data analysis.

**Ask me about:**
- Disease prevalence and trends
- Risk factors by age and region  
- Pathogen distribution patterns
- Public health interventions

> **Tip:** Enable "Include filtered data" in settings to analyze your specific data selection.`,
					timestamp: new Date()
				}
			];
		}
	}
</script>

<!-- Modal backdrop -->
<div
	class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
	on:click={closeModal}
	role="button"
	tabindex="0"
	on:keydown={(e) => e.key === 'Escape' && closeModal()}
></div>

<!-- Chat Modal -->
<div class="fixed bottom-6 right-6 z-50 w-[48rem] max-w-[calc(100vw-3rem)]">
	<div class="bg-base-100 border-base-300 overflow-hidden rounded-lg border shadow-2xl">
		<!-- Header -->
		<div class="bg-primary text-primary-content flex items-center justify-between px-4 py-3">
			<div class="flex items-center gap-2">
				<MaterialSymbolsSmartToy class="h-5 w-5" />
				<span class="font-semibold">AI Assistant</span>
				{#if currentSettings.useGemini && currentApiKey}
					<span class="badge badge-sm bg-primary-focus">Gemini</span>
				{/if}
				{#if currentSettings.includeFilteredData && currentSettings.useGemini}
					<span class="badge badge-sm bg-primary-focus" title="Filtered data included">
						<MaterialSymbolsDataset class="h-3 w-3 mr-1" />
						Data
					</span>
				{/if}
			</div>
			<div class="flex items-center gap-1">
				<button
					class="btn btn-ghost btn-sm btn-circle text-primary-content hover:bg-primary-focus"
					on:click={() => showSettings = true}
					aria-label="Settings"
					title="Settings"
				>
					<MaterialSymbolsSettings class="h-4 w-4" />
				</button>
				<button
					class="btn btn-ghost btn-sm btn-circle text-primary-content hover:bg-primary-focus"
					on:click={clearConversation}
					aria-label="New conversation"
					title="New conversation"
				>
					<MaterialSymbolsAdd class="h-4 w-4" />
				</button>
				<button
					class="btn btn-ghost btn-sm btn-circle text-primary-content hover:bg-primary-focus"
					on:click={closeModal}
					aria-label="Close chat"
				>
					<MaterialSymbolsClose class="h-4 w-4" />
				</button>
			</div>
		</div>

		<!-- Chat Messages -->
		<div bind:this={chatContainer} class="h-[40rem] space-y-4 overflow-y-auto p-4">
			{#each messages as message (message.id)}
				<div class="flex gap-3" class:flex-row-reverse={message.type === 'user'}>
					<!-- Avatar -->
					<div class="flex-shrink-0">
						<div
							class="flex h-8 w-8 items-center justify-center rounded-full"
							class:bg-primary={message.type === 'bot'}
							class:text-primary-content={message.type === 'bot'}
							class:bg-secondary={message.type === 'user'}
							class:text-secondary-content={message.type === 'user'}
						>
							{#if message.type === 'bot'}
								<MaterialSymbolsSmartToy class="h-4 w-4" />
							{:else}
								<MaterialSymbolsPerson class="h-4 w-4" />
							{/if}
						</div>
					</div>

					<!-- Message Bubble -->
					<div class="max-w-lg flex-1">
						<div
							class="rounded-lg px-3 py-2 text-sm"
							class:bg-primary={message.type === 'bot'}
							class:text-primary-content={message.type === 'bot'}
							class:bg-secondary={message.type === 'user'}
							class:text-secondary-content={message.type === 'user'}
						>
							{#if message.type === 'bot'}
								<div class="markdown-content prose prose-sm max-w-none">
									{@html renderMarkdown(message.content)}
								</div>
							{:else}
								{message.content}
							{/if}
						</div>
						<div class="mt-1 text-xs opacity-60" class:text-right={message.type === 'user'}>
							{formatTime(message.timestamp)}
						</div>
					</div>
				</div>
			{/each}

			<!-- Typing indicator -->
			{#if isTyping}
				<div class="flex gap-3">
					<div class="flex-shrink-0">
						<div
							class="bg-primary text-primary-content flex h-8 w-8 items-center justify-center rounded-full"
						>
							<MaterialSymbolsSmartToy class="h-4 w-4" />
						</div>
					</div>
					<div class="max-w-sm flex-1">
						<div class="bg-primary text-primary-content rounded-lg px-3 py-2 text-sm">
							<div class="flex gap-1">
								<div class="h-2 w-2 animate-bounce rounded-full bg-current"></div>
								<div
									class="h-2 w-2 animate-bounce rounded-full bg-current"
									style="animation-delay: 0.1s;"
								></div>
								<div
									class="h-2 w-2 animate-bounce rounded-full bg-current"
									style="animation-delay: 0.2s;"
								></div>
							</div>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Input Area -->
		<div class="border-base-300 border-t p-4">
			{#if !currentApiKey}
				<div class="alert alert-warning text-sm">
					<MaterialSymbolsSettings class="h-4 w-4" />
					<span>Please configure your Gemini API key in settings to start chatting.</span>
					<button 
						class="btn btn-sm btn-primary"
						on:click={() => showSettings = true}
					>
						Open Settings
					</button>
				</div>
			{:else}
				<div class="flex gap-2">
					<textarea
						bind:value={messageInput}
						on:keydown={handleKeyPress}
						placeholder="Type your message..."
						class="textarea textarea-bordered max-h-32 min-h-[2.5rem] flex-1 resize-none"
						rows="1"
					></textarea>
					<button
						class="btn btn-primary btn-square"
						on:click={sendMessage}
						disabled={!messageInput.trim()}
						aria-label="Send message"
					>
						<MaterialSymbolsSend class="h-4 w-4" />
					</button>
				</div>
				<div class="mt-2 text-xs opacity-60">Press Enter to send, Shift + Enter for new line</div>
			{/if}
		</div>
	</div>
</div>

<!-- Settings Modal -->
{#if showSettings}
	<ChatSettings on:close={() => showSettings = false} />
{/if}

<style>
	@keyframes bounce {
		0%,
		80%,
		100% {
			transform: translateY(0);
		}
		40% {
			transform: translateY(-5px);
		}
	}

	.animate-bounce {
		animation: bounce 1.4s ease-in-out infinite;
	}

	/* Markdown content styling */
	:global(.markdown-content) {
		color: inherit !important;
	}

	:global(.markdown-content *) {
		color: inherit !important;
	}

	:global(.markdown-content h1,
	.markdown-content h2,
	.markdown-content h3,
	.markdown-content h4,
	.markdown-content h5,
	.markdown-content h6) {
		color: inherit !important;
		font-weight: 600;
		margin-top: 0.5em;
		margin-bottom: 0.25em;
	}

	:global(.markdown-content p) {
		color: inherit !important;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}

	:global(.markdown-content ul,
	.markdown-content ol) {
		color: inherit !important;
		margin-left: 1.5em;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}

	:global(.markdown-content li) {
		color: inherit !important;
		margin-top: 0.25em;
		margin-bottom: 0.25em;
	}

	:global(.markdown-content code) {
		color: inherit !important;
		background-color: rgba(0, 0, 0, 0.2);
		padding: 0.125em 0.25em;
		border-radius: 0.25em;
		font-size: 0.875em;
	}

	:global(.markdown-content pre) {
		color: inherit !important;
		background-color: rgba(0, 0, 0, 0.3);
		padding: 0.75em;
		border-radius: 0.375em;
		overflow-x: auto;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}

	:global(.markdown-content pre code) {
		color: inherit !important;
		background-color: transparent;
		padding: 0;
	}

	:global(.markdown-content blockquote) {
		color: inherit !important;
		border-left: 3px solid currentColor;
		padding-left: 1em;
		margin-left: 0;
		opacity: 0.8;
		font-style: italic;
	}

	:global(.markdown-content blockquote *) {
		color: inherit !important;
	}

	:global(.markdown-content a) {
		color: inherit !important;
		text-decoration: underline;
		opacity: 0.9;
	}

	:global(.markdown-content a:hover) {
		opacity: 1;
	}

	:global(.markdown-content strong) {
		color: inherit !important;
		font-weight: 600;
	}

	:global(.markdown-content em) {
		color: inherit !important;
		font-style: italic;
	}

	:global(.markdown-content hr) {
		border: none;
		border-top: 1px solid currentColor;
		opacity: 0.3;
		margin: 1em 0;
	}

	:global(.markdown-content table) {
		width: 100%;
		border-collapse: collapse;
		margin: 0.5em 0;
	}

	:global(.markdown-content th,
	.markdown-content td) {
		color: inherit !important;
		padding: 0.5em;
		border: 1px solid rgba(255, 255, 255, 0.2);
		text-align: left;
	}

	:global(.markdown-content th) {
		background-color: rgba(0, 0, 0, 0.2);
		font-weight: 600;
	}
</style>
