import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import type { PointFeatureCollection } from '$lib/types';

export interface FilteredDataContext {
	pathogens: Set<string>;
	ageGroups: Set<string>;
	syndromes: Set<string>;
	totalPoints: number;
	filteredPoints: number;
	dataSnapshot?: any[];
}

export class GeminiService {
	private genAI: GoogleGenerativeAI | null = null;
	private model: any = null;

	constructor(apiKey?: string) {
		if (apiKey) {
			this.initialize(apiKey);
		}
	}

	initialize(apiKey: string) {
		if (!apiKey) {
			throw new Error('API key is required');
		}

		this.genAI = new GoogleGenerativeAI(apiKey);
		
		// Use Gemini 2.0 Flash model for fast responses
		this.model = this.genAI.getGenerativeModel({
			model: 'gemini-2.0-flash-exp',
			generationConfig: {
				temperature: 0.7,
				topK: 40,
				topP: 0.95,
				maxOutputTokens: 2048,
			},
			safetySettings: [
				{
					category: HarmCategory.HARM_CATEGORY_HARASSMENT,
					threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
				},
				{
					category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
					threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
				},
				{
					category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
					threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
				},
				{
					category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
					threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
				},
			],
		});
	}

	formatDataContext(
		filteredData: PointFeatureCollection | null,
		context: FilteredDataContext
	): string {
		let contextString = '## Current Data Context\n\n';

		// Add filter information
		if (context.pathogens.size > 0) {
			contextString += `**Selected Pathogens:** ${Array.from(context.pathogens).join(', ')}\n`;
		}
		if (context.ageGroups.size > 0) {
			contextString += `**Selected Age Groups:** ${Array.from(context.ageGroups).join(', ')}\n`;
		}
		if (context.syndromes.size > 0) {
			contextString += `**Selected Syndromes:** ${Array.from(context.syndromes).join(', ')}\n`;
		}

		contextString += `\n**Data Points:** ${context.filteredPoints} out of ${context.totalPoints} total\n`;

		// Add sample of data if available
		if (filteredData && filteredData.features.length > 0) {
			const sampleSize = Math.min(5, filteredData.features.length);
			contextString += '\n### Sample Data Points:\n```json\n';
			
			const sample = filteredData.features.slice(0, sampleSize).map(feature => ({
				pathogen: feature.properties.PATHOGEN,
				age: feature.properties.AGE_LAB,
				syndrome: feature.properties.SYNDROME_LAB,
				year: feature.properties.YEAR,
				prevalence: feature.properties.PCT_POS,
				positiveCount: feature.properties.POS_CNT,
				totalCount: feature.properties.TOTAL_CNT,
				location: {
					lat: feature.geometry.coordinates[1],
					lon: feature.geometry.coordinates[0]
				}
			}));
			
			contextString += JSON.stringify(sample, null, 2);
			contextString += '\n```\n';

			// Add summary statistics
			const stats = this.calculateStats(filteredData);
			if (stats) {
				contextString += '\n### Summary Statistics:\n';
				contextString += `- Average Prevalence: ${stats.avgPrevalence.toFixed(2)}%\n`;
				contextString += `- Total Positive Cases: ${stats.totalPositive}\n`;
				contextString += `- Total Tests: ${stats.totalTests}\n`;
				contextString += `- Year Range: ${stats.minYear} - ${stats.maxYear}\n`;
				
				if (stats.pathogenCounts.size > 0) {
					contextString += '\n**Cases by Pathogen:**\n';
					Array.from(stats.pathogenCounts.entries())
						.sort((a, b) => b[1] - a[1])
						.slice(0, 10)
						.forEach(([pathogen, count]) => {
							contextString += `- ${pathogen}: ${count} positive cases\n`;
						});
				}
			}
		}

		return contextString;
	}

	private calculateStats(data: PointFeatureCollection) {
		if (!data.features || data.features.length === 0) return null;

		let totalPositive = 0;
		let totalTests = 0;
		let prevalenceSum = 0;
		let minYear = Infinity;
		let maxYear = -Infinity;
		const pathogenCounts = new Map<string, number>();

		data.features.forEach(feature => {
			const props = feature.properties;
			
			if (props.POS_CNT) totalPositive += props.POS_CNT;
			if (props.TOTAL_CNT) totalTests += props.TOTAL_CNT;
			if (props.PCT_POS) prevalenceSum += props.PCT_POS;
			
			if (props.YEAR) {
				minYear = Math.min(minYear, props.YEAR);
				maxYear = Math.max(maxYear, props.YEAR);
			}

			if (props.PATHOGEN && props.POS_CNT) {
				const current = pathogenCounts.get(props.PATHOGEN) || 0;
				pathogenCounts.set(props.PATHOGEN, current + props.POS_CNT);
			}
		});

		return {
			totalPositive,
			totalTests,
			avgPrevalence: prevalenceSum / data.features.length,
			minYear: minYear === Infinity ? null : minYear,
			maxYear: maxYear === -Infinity ? null : maxYear,
			pathogenCounts
		};
	}

	async sendMessage(
		message: string,
		dataContext?: string,
		conversationHistory?: Array<{ role: string; content: string }>
	): Promise<string> {
		if (!this.model) {
			throw new Error('Gemini model not initialized. Please set your API key.');
		}

		try {
			// Build the conversation with system prompt
			const systemPrompt = `You are an AI assistant helping users analyze epidemiological data. 
You have expertise in data analysis, statistics, and visualization.
Be concise, accurate, and helpful in your responses.
When discussing data, provide specific insights and actionable recommendations.`;

			let fullPrompt = systemPrompt + '\n\n';

			// Add data context if provided
			if (dataContext) {
				fullPrompt += dataContext + '\n\n';
			}

			// Add conversation history if provided
			if (conversationHistory && conversationHistory.length > 0) {
				fullPrompt += '## Conversation History:\n';
				conversationHistory.forEach(msg => {
					fullPrompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
				});
				fullPrompt += '\n';
			}

			// Add current message
			fullPrompt += `User: ${message}\n\nAssistant:`;

			// Generate response
			const result = await this.model.generateContent(fullPrompt);
			const response = await result.response;
			const text = response.text();

			return text;
		} catch (error) {
			console.error('Gemini API error:', error);
			throw new Error(`Failed to get response from Gemini: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	isInitialized(): boolean {
		return this.model !== null;
	}
}