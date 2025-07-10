import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// This is a placeholder implementation that can integrate with LabEvaluationSystem's auth
export const protect = async (req, res, next) => {
  try {
    let token;
    
    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // If no token is provided, continue anyway (for now)
    if (!token) {
      console.log('No auth token provided - continuing with limited access');
      return next();
    }
    
    try {
      // Try to verify the token (if JWT_SECRET is set)
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devmode-secret');
      
      // Find the user
      const user = await User.findById(decoded.id);
      if (user) {
        // Attach user to request
        req.user = user;
      }
    } catch (error) {
      console.log('Invalid token provided - continuing with limited access');
    }
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    next();
  }
};

// Role-based authorization
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized, no user found' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized for this action' });
    }
    
    next();
  };
};
