import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './errorHandler';

const forceErrorSchema = Joi.object({
  code: Joi.number().valid(400, 429, 500, 503).required(),
  message: Joi.string().optional()
});

export const sendSmsSchema = Joi.object({
  from: Joi.string().required().min(1).max(100)
    .messages({
      'string.empty': 'From field is required',
      'string.min': 'From field cannot be empty',
      'string.max': 'From field is too long'
    }),
  to: Joi.string().required().min(1).max(100)
    .messages({
      'string.empty': 'To field is required',
      'string.min': 'To field cannot be empty',
      'string.max': 'To field is too long'
    }),
  type: Joi.string().valid('sms', 'mms').required()
    .messages({
      'any.only': 'Type must be either "sms" or "mms"'
    }),
  body: Joi.string().required().min(1).max(1600)
    .messages({
      'string.empty': 'Body field is required',
      'string.min': 'Body cannot be empty',
      'string.max': 'Body is too long (max 1600 characters)'
    }),
  attachments: Joi.array().items(Joi.string().uri()).optional().allow(null)
    .messages({
      'array.base': 'Attachments must be an array of URLs',
      'string.uri': 'Each attachment must be a valid URL'
    }),
  timestamp: Joi.string().isoDate().required()
    .messages({
      'string.isoDate': 'Timestamp must be a valid ISO date string'
    }),
  _forceError: forceErrorSchema.optional()
});

export const sendEmailSchema = Joi.object({
  from: Joi.string().email().required()
    .messages({
      'string.email': 'From must be a valid email address',
      'string.empty': 'From field is required'
    }),
  to: Joi.string().email().required()
    .messages({
      'string.email': 'To must be a valid email address',
      'string.empty': 'To field is required'
    }),
  body: Joi.string().required().min(1)
    .messages({
      'string.empty': 'Body field is required',
      'string.min': 'Body cannot be empty'
    }),
  attachments: Joi.array().items(Joi.string().uri()).optional()
    .messages({
      'array.base': 'Attachments must be an array of URLs',
      'string.uri': 'Each attachment must be a valid URL'
    }),
  timestamp: Joi.string().isoDate().required()
    .messages({
      'string.isoDate': 'Timestamp must be a valid ISO date string'
    }),
  _forceError: forceErrorSchema.optional()
});

export function validateRequest(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { 
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join('; ');
      
      throw new ValidationError(errorMessage);
    }

    next();
  };
}