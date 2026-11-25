import { Injectable } from '@nestjs/common';
import { AppLogger, createId } from '@orderflow/common';

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export interface EmailMessage {
  toUserId: string;
  subject: string;
  body: string;
}

export interface EmailDeliveryResult {
  messageId: string;
  deliveredAt: Date;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<EmailDeliveryResult>;
}

@Injectable()
export class SimulatedEmailSender implements EmailSender {
  private readonly logger: AppLogger;

  constructor() {
    this.logger = new AppLogger('SimulatedEmail');
  }

  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    const messageId = createId();
    const deliveredAt = new Date();
    this.logger.log(
      `[SIMULATED EMAIL] to=${message.toUserId} subject="${message.subject}" messageId=${messageId}`,
    );
    return { messageId, deliveredAt };
  }
}
