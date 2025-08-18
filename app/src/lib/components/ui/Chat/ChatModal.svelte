<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import MaterialSymbolsClose from '~icons/material-symbols/close';
	import MaterialSymbolsSend from '~icons/material-symbols/send';
	import MaterialSymbolsSmartToy from '~icons/material-symbols/smart-toy';
	import MaterialSymbolsPerson from '~icons/material-symbols/person';
	import MaterialSymbolsAdd from '~icons/material-symbols/add';
	import { browser } from '$app/environment';

	const dispatch = createEventDispatcher();

	// Chat API configuration
	const CHAT_API_URL = browser ? 'http://localhost:4040' : 'http://chat-backend:4040';

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
				// If API fails, set default welcome message
				messages = [
					{
						id: 'welcome-1',
						type: 'bot',
						content: "Hello! I'm your AI assistant. How can I help you today?",
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
				// Fallback to default message if no stored messages and API fails
				messages = [
					{
						id: 'fallback-1',
						type: 'bot',
						content: "Hello! I'm your AI assistant. How can I help you today?",
						timestamp: new Date()
					}
				];
			}
		} finally {
			isLoading = false;
		}
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
			// Send message to API
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
				const botMessage = {
					id: botResponse.id,
					type: botResponse.type,
					content: botResponse.content,
					timestamp: new Date(botResponse.timestamp)
				};

				messages = [...messages, botMessage];
			} else {
				throw new Error('Failed to send message');
			}
		} catch (error) {
			console.error('Failed to send message:', error);
			// Fallback response if API fails
			const fallbackMessage = {
				id: `fallback-${Date.now()}`,
				type: 'bot',
				content:
					"I'm sorry, I'm having trouble connecting to the server right now. Please try again later.",
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

	function clearConversation() {
		if (browser) {
			// Clear localStorage
			localStorage.removeItem(MESSAGES_STORAGE_KEY);
			localStorage.removeItem(STORAGE_KEY);
			
			// Reset messages to welcome message
			messages = [
				{
					id: 'welcome-new',
					type: 'bot',
					content: "Hello! I'm your AI assistant. How can I help you today?",
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
<div class="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)]">
	<div class="bg-base-100 border-base-300 overflow-hidden rounded-lg border shadow-2xl">
		<!-- Header -->
		<div class="bg-primary text-primary-content flex items-center justify-between px-4 py-3">
			<div class="flex items-center gap-2">
				<MaterialSymbolsSmartToy class="h-5 w-5" />
				<span class="font-semibold">AI Assistant</span>
			</div>
			<div class="flex items-center gap-1">
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
		<div bind:this={chatContainer} class="h-96 space-y-4 overflow-y-auto p-4">
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
					<div class="max-w-xs flex-1">
						<div
							class="rounded-lg px-3 py-2 text-sm"
							class:bg-primary={message.type === 'bot'}
							class:text-primary-content={message.type === 'bot'}
							class:bg-secondary={message.type === 'user'}
							class:text-secondary-content={message.type === 'user'}
						>
							{message.content}
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
					<div class="max-w-xs flex-1">
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
		</div>
	</div>
</div>

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
</style>
