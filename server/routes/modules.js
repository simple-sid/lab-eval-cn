import express from 'express';
import { CNModule } from '../models/Module.js';
import mongoose from 'mongoose';

const router = express.Router();

// Create a module
router.post('/', async (req, res) => {
  try {
    const { name, description, lab, questions, creator, maxMarks } = req.body;

    // Validate that at least one question is selected.
    if (!questions || questions.length === 0) {
      return res.status(400).json({ error: 'At least one question must be selected.' });
    }

    const moduleData = {
      name,
      description,
      lab,
      questions,
      creator, 
      maxMarks,
      moduleType: "CNModule"
    };

    const newModule = await CNModule.create(moduleData);
    res.status(201).json(newModule);
  } catch (err) {
    console.error('Module creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all modules
router.get('/', async (req, res) => {
  try {
    const modules = await CNModule.find().populate('questions');
    res.status(200).json(modules);
  } catch (err) {
    console.error('Error fetching modules:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get a single module
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid module ID' });
    }
    
    const module = await CNModule.findById(id).populate('questions');
    
    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }
    
    res.status(200).json(module);
  } catch (err) {
    console.error('Error fetching module:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update a module
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, lab, questions, maxMarks } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid module ID' });
    }
    
    // Validate that at least one question is selected
    if (!questions || questions.length === 0) {
      return res.status(400).json({ error: 'At least one question must be selected.' });
    }
    
    const updatedModule = await CNModule.findByIdAndUpdate(
      id,
      { name, description, lab, questions, maxMarks },
      { new: true, runValidators: true }
    );
    
    if (!updatedModule) {
      return res.status(404).json({ error: 'Module not found' });
    }
    
    res.status(200).json(updatedModule);
  } catch (err) {
    console.error('Module update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a module
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid module ID' });
    }
    
    const deletedModule = await CNModule.findByIdAndDelete(id);
    
    if (!deletedModule) {
      return res.status(404).json({ error: 'Module not found' });
    }
    
    res.status(200).json({ message: 'Module deleted successfully' });
  } catch (err) {
    console.error('Module deletion error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Quick update module for lab sessions
router.patch('/:id/quick-update', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid module ID' });
    }
    
    // Validate allowed update fields for quick updates
    const allowedUpdates = ['name', 'description', 'maxMarks'];
    const updateKeys = Object.keys(updates);
    const isValidOperation = updateKeys.every(key => allowedUpdates.includes(key));
    
    if (!isValidOperation) {
      return res.status(400).json({ error: 'Invalid updates. Only name, description, and maxMarks can be quick-updated during a lab session.' });
    }
    
    const updatedModule = await CNModule.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );
    
    if (!updatedModule) {
      return res.status(404).json({ error: 'Module not found' });
    }
    
    // In a real implementation, here you would notify active sessions
    // that are currently using this module about the changes
    
    res.status(200).json({ 
      message: 'Module updated successfully',
      module: updatedModule
    });
  } catch (err) {
    console.error('Quick module update error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;