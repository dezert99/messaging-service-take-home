import { Request, Response, NextFunction } from 'express';
import { sendSmsMessage, sendEmailMessage } from '../services/messageService';
import { SendSmsRequest, SendEmailRequest } from '../types/requests';
import { ProviderError } from '../providers/interfaces';
import { logger } from '../utils/logger';

export async function sendSms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const request: SendSmsRequest = req.body;
    
    const result = await sendSmsMessage(request);
    
    res.status(201).json({
      success: true,
      message: {
        id: result.message.id,
        conversationId: result.message.conversationId,
        from: result.message.from,
        to: result.message.to,
        type: result.message.type,
        body: result.message.body,
        attachments: result.message.attachments,
        status: result.message.status,
        timestamp: result.message.timestamp,
        providerMessageId: result.message.providerMessageId
      },
      provider: {
        sid: result.providerResponse.sid,
        status: result.providerResponse.status,
        uri: result.providerResponse.uri
      }
    });
  } catch (error) {
    // Handle provider errors with specific status codes
    if (error instanceof Error && 'statusCode' in error) {
      const providerError = error as ProviderError;
      res.status(providerError.statusCode).json({
        success: false,
        error: providerError.message,
        code: providerError.statusCode
      });
      return;
    }
    
    next(error);
  }
}

export async function sendEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const request: SendEmailRequest = req.body;
    
    const result = await sendEmailMessage(request);
    
    res.status(201).json({
      success: true,
      message: {
        id: result.message.id,
        conversationId: result.message.conversationId,
        from: result.message.from,
        to: result.message.to,
        type: result.message.type,
        body: result.message.body,
        attachments: result.message.attachments,
        status: result.message.status,
        timestamp: result.message.timestamp,
        providerMessageId: result.message.providerMessageId
      },
      provider: {
        message_id: result.providerResponse.message_id,
        statusCode: result.providerResponse.statusCode
      }
    });
  } catch (error) {
    // Handle provider errors with specific status codes
    if (error instanceof Error && 'statusCode' in error) {
      const providerError = error as ProviderError;
      res.status(providerError.statusCode).json({
        success: false,
        error: providerError.message,
        code: providerError.statusCode
      });
      return;
    }
    
    next(error);
  }
}