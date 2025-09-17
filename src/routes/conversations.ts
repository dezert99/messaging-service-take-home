import { Router } from 'express';
import { getConversations, getConversationMessages } from '../controllers/conversationController';

const router = Router();

// GET /api/conversations - List conversations for a participant
router.get('/', getConversations);

// GET /api/conversations/:id/messages - Get messages in a specific conversation
router.get('/:id/messages', getConversationMessages);

export default router;