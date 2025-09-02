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
		
		// Use Gemini 2.5 Flash-Lite (ultra-fast, lightweight model)
		this.model = this.genAI.getGenerativeModel({
			model: 'gemini-2.5-flash-lite',
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

		// Add filtered data if available
		if (filteredData && filteredData.features.length > 0) {
			const totalPoints = filteredData.features.length;
			
			// Determine how many points to include based on total count
			// If less than 100 points, include all
			// If more, include a representative sample plus aggregated statistics
			const MAX_FULL_POINTS = 100; // Include all data if under this threshold
			const SAMPLE_SIZE = 50; // Sample size for larger datasets
			
			if (totalPoints <= MAX_FULL_POINTS) {
				// Include ALL data points for small datasets
				contextString += `\n### Complete Filtered Dataset (${totalPoints} points):\n\`\`\`json\n`;
				
				const allDataPoints = filteredData.features.map(feature => ({
					// Core identifiers
					pathogen: feature.properties.pathogen,
					ageGroup: feature.properties.ageGroupLab,
					syndrome: feature.properties.syndromeLab,
					
					// Epidemiological data
					prevalence: feature.properties.prevalenceValue * 100, // Convert to percentage
					cases: feature.properties.cases,
					samples: feature.properties.samples,
					standardError: feature.properties.standardError,
					
					// Study metadata
					studyDesign: feature.properties.design,
					location: feature.properties.location,
					duration: feature.properties.duration,
					source: feature.properties.source,
					ageRange: feature.properties.ageRange,
					
					// Geographic coordinates
					coordinates: {
						lat: feature.geometry.coordinates[1],
						lon: feature.geometry.coordinates[0]
					}
				}));
				
				contextString += JSON.stringify(allDataPoints, null, 2);
				contextString += '\n```\n';
				
				console.log(`📊 Including ALL ${totalPoints} filtered data points in context`);
			} else {
				// For larger datasets, include a sample plus aggregated data
				contextString += `\n### Dataset Sample (${SAMPLE_SIZE} of ${totalPoints} points):\n\`\`\`json\n`;
				
				// Take a stratified sample to ensure representation
				const sampleIndices = new Set<number>();
				const step = Math.floor(totalPoints / SAMPLE_SIZE);
				for (let i = 0; i < totalPoints && sampleIndices.size < SAMPLE_SIZE; i += step) {
					sampleIndices.add(i);
				}
				
				const sampleDataPoints = Array.from(sampleIndices).map(idx => {
					const feature = filteredData.features[idx];
					return {
						// Core identifiers
						pathogen: feature.properties.pathogen,
						ageGroup: feature.properties.ageGroupLab,
						syndrome: feature.properties.syndromeLab,
						
						// Epidemiological data
						prevalence: feature.properties.prevalenceValue * 100, // Convert to percentage
						cases: feature.properties.cases,
						samples: feature.properties.samples,
						standardError: feature.properties.standardError,
						
						// Study metadata
						studyDesign: feature.properties.design,
						location: feature.properties.location,
						duration: feature.properties.duration,
						source: feature.properties.source,
						ageRange: feature.properties.ageRange,
						
						// Geographic coordinates
						coordinates: {
							lat: feature.geometry.coordinates[1],
							lon: feature.geometry.coordinates[0]
						}
					};
				});
				
				contextString += JSON.stringify(sampleDataPoints, null, 2);
				contextString += '\n```\n';
				
				console.log(`📊 Including ${SAMPLE_SIZE} sample points from ${totalPoints} total filtered data points`);
				
				// Add note about sampling
				contextString += `\n*Note: Showing a representative sample of ${SAMPLE_SIZE} points from the total ${totalPoints} filtered data points to stay within token limits.*\n`;
			}

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
			
			// Use correct property names
			if (props.cases) totalPositive += props.cases;
			if (props.samples) totalTests += props.samples;
			if (props.prevalenceValue) prevalenceSum += (props.prevalenceValue * 100); // Convert to percentage
			
			// Extract year from duration field if available (e.g., "2018-2019")
			if (props.duration) {
				const yearMatch = props.duration.match(/\d{4}/);
				if (yearMatch) {
					const year = parseInt(yearMatch[0]);
					minYear = Math.min(minYear, year);
					maxYear = Math.max(maxYear, year);
				}
			}

			if (props.pathogen && props.cases) {
				const current = pathogenCounts.get(props.pathogen) || 0;
				pathogenCounts.set(props.pathogen, current + props.cases);
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
				console.log('🔍 Data context added to prompt, length:', dataContext.length);
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

			// Log the full prompt
			console.log('📤 Full Prompt to Gemini:');
			console.log('================================');
			console.log(fullPrompt);
			console.log('================================');
			console.log('Prompt length:', fullPrompt.length, 'characters');

			// Generate response
			const result = await this.model.generateContent(fullPrompt);
			const response = await result.response;
			const text = response.text();
			
			console.log('📥 Gemini Response Length:', text.length, 'characters');

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