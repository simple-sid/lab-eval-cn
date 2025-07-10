import express from 'express';
import Course from '../models/Course.js';
import mongoose from 'mongoose';

const router = express.Router();

// Get all courses
router.get('/', async (req, res) => {
  try {
    const courses = await Course.find();
    res.status(200).json(courses);
  } catch (err) {
    console.error('Error fetching courses:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get a single course
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid course ID' });
    }
    
    const course = await Course.findById(id);
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    res.status(200).json(course);
  } catch (err) {
    console.error('Error fetching course:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create a course
router.post('/', async (req, res) => {
  try {
    const { name, code, semester, parameters } = req.body;
    
    // Check if course with same code already exists
    const existingCourse = await Course.findOne({ code });
    if (existingCourse) {
      return res.status(400).json({ error: 'Course with this code already exists' });
    }
    
    const course = await Course.create({
      name,
      code,
      semester,
      parameters: parameters || {}
    });
    
    res.status(201).json(course);
  } catch (err) {
    console.error('Error creating course:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update a course
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, semester, parameters } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid course ID' });
    }
    
    // Check if course exists
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    // Check if updated code would conflict with another course
    if (code && code !== course.code) {
      const existingCourse = await Course.findOne({ code, _id: { $ne: id } });
      if (existingCourse) {
        return res.status(400).json({ error: 'Course with this code already exists' });
      }
    }
    
    const updatedCourse = await Course.findByIdAndUpdate(
      id,
      {
        name: name || course.name,
        code: code || course.code,
        semester: semester || course.semester,
        parameters: parameters || course.parameters
      },
      { new: true }
    );
    
    res.status(200).json(updatedCourse);
  } catch (err) {
    console.error('Error updating course:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a course
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid course ID' });
    }
    
    const course = await Course.findByIdAndDelete(id);
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    res.status(200).json({ message: 'Course deleted successfully' });
  } catch (err) {
    console.error('Error deleting course:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
