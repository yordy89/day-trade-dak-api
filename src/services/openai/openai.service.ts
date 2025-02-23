import { Inject, Injectable } from '@nestjs/common';
import { AxiosInstance } from 'axios';
import { UserService } from 'src/users/users.service';

@Injectable()
export class OpenAiService {
  constructor(
    private readonly userService: UserService,
    @Inject('OPEN_AI_AXIOS') private readonly axios: AxiosInstance,
  ) {}
  async determinePhase(description: string, userId: string): Promise<any> {
    const prompt = `Given this trading challenge: "${description}", classify it into one of the following trading phases:

1. **Understanding Market Basics** - Learning fundamental concepts like order types, market structure, and trading terminology.
2. **Setting Up Your Trading Plan** - Defining goals, risk tolerance, and choosing a trading style (e.g., scalping, swing trading, investing).
3. **Learning Technical and Fundamental Analysis** - Studying price charts, indicators, news events, and economic data to make informed trades.
4. **Practicing on a Demo Account** - Simulating trades in a risk-free environment to build confidence and test strategies.
5. **Executing Trades with Real Money** - Transitioning to live trading with a small account while managing emotions and risk.
6. **Developing Risk Management Strategies** - Implementing stop losses, position sizing, and risk-reward ratios to protect capital.
7. **Refining Strategy and Handling Losses** - Adjusting trading strategies based on performance reviews and minimizing emotional reactions.
8. **Building Consistency and Discipline** - Establishing a routine, maintaining a trading journal, and sticking to the plan.
9. **Scaling Up and Optimizing Profits** - Increasing trade sizes, improving execution, and refining strategy for higher efficiency.
10. **Consistently Profitable Trading** - Achieving steady profitability with a well-optimized system and strong emotional control.

Return only the phase number.`;

    const { data } = await this.axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
      },
    );
    console.log(data.choices[0].message.content.trim());
    const tradingPhase = Number(data.choices[0].message.content.trim());
    await this.userService.updateUser(userId, { tradingPhase });
    return { tradingPhase };
  }
}
