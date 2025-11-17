export class AIService {
  constructor(private apiKey: string) {}

  async generateContent(prompt: string) {
    return {
      content: `AI generated content for: ${prompt}`,
      tokens: 100,
      cost: 0.001
    };
  }

  async generateReply(message: string) {
    return {
      content: `AI reply to: ${message}`,
      tokens: 50,
      cost: 0.0005
    };
  }
}