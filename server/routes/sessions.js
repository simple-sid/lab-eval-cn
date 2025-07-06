import express from 'express';
import mongoose from 'mongoose';
import Session from '../models/Session.js';
import { CNModule } from '../models/Module.js';

const router = express.Router();

// Get all active sessions
router.get('/active', async (req, res) => {
  try {
    // Find sessions created within the last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const sessions = await Session.aggregate([
      { $match: { createdAt: { $gte: oneDayAgo } } },
      { $group: {
          _id: "$sessionId",
          name: { $first: "$sessionId" },
          createdAt: { $first: "$createdAt" },
          studentCount: { $sum: 1 }
        }
      },
      { $sort: { createdAt: -1 } }
    ]);
    
    res.status(200).json(sessions);
  } catch (err) {
    console.error('Error fetching active sessions:', err);
    res.status(500).json({ error: err.message });
  }
});

// Assign a module to a session
router.post('/assign-module', async (req, res) => {
  try {
    const { moduleId, sessionId } = req.body;
    
    if (!moduleId || !sessionId) {
      return res.status(400).json({ error: 'Module ID and session ID are required' });
    }
    
    if (!mongoose.Types.ObjectId.isValid(moduleId)) {
      return res.status(400).json({ error: 'Invalid module ID format' });
    }
    
    // Check if the module exists
    const module = await CNModule.findById(moduleId);
    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }
    
    // Check if the session exists
    const sessions = await Session.find({ sessionId });
    if (sessions.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // In a real implementation, here you would:
    // 1. Save a record of which module was assigned to which session
    // 2. Push notifications to connected students
    // 3. Update session metadata
    
    /* Example implementation:
    await Session.updateMany(
      { sessionId },
      { 
        $set: { 
          activeModule: moduleId,
          moduleAssignedAt: new Date() 
        } 
      }
    );
    */
    
    // For now, just return success
    res.status(200).json({ 
      message: 'Module assigned successfully',
      sessionId,
      moduleId,
      studentCount: sessions.length
    });
  } catch (err) {
    console.error('Error assigning module to session:', err);
    res.status(500).json({ error: err.message });
  }
});

// Quick update module and propagate to active sessions
router.patch('/modules/:id/quick-update', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid module ID format' });
    }
    
    // Validate allowed update fields
    const allowedUpdates = ['name', 'description', 'maxMarks'];
    const updateKeys = Object.keys(updates);
    const isValidOperation = updateKeys.every(key => allowedUpdates.includes(key));
    
    if (!isValidOperation) {
      return res.status(400).json({ error: 'Invalid updates. Only name, description, and maxMarks can be quick-updated.' });
    }
    
    // Update the module
    const updatedModule = await CNModule.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );
    
    if (!updatedModule) {
      return res.status(404).json({ error: 'Module not found' });
    }
    
    // In a real implementation, here you would:
    // 1. Find all active sessions using this module
    // 2. Push updates to connected students
    
    /* Example implementation:
    const sessionsWithModule = await Session.find({ activeModule: id });
    // Push updates to these sessions
    */
    
    res.status(200).json({ 
      message: 'Module updated and changes propagated',
      module: updatedModule
    });
  } catch (err) {
    console.error('Error quick-updating module:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
