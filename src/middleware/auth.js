const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let email;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      email = req.headers.authorization.split(' ')[1];
    }
    
    if (!email) {
      return res.status(401).json({ message: 'Not authorized, no token/email' });
    }

    // Try to find the user or create a basic placeholder user based on email (for demo purposes)
    let user = await User.findOne({ email });
    if (!user) {
      try {
        user = await User.create({
          email,
          name: email.split('@')[0],
          role: (email === 'admin@example.com' || email === 'huynguyen2542004@gmail.com') ? 'admin' : 'user'
        });
      } catch (err) {
        if (err.code === 11000) {
          user = await User.findOne({ email });
        } else {
          throw err;
        }
      }
    } else if (email === 'huynguyen2542004@gmail.com' && user.role !== 'admin') {
      user.role = 'admin';
      await user.save();
    }

    req.user = user;
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: 'Not authorized' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(401).json({ message: 'Not authorized as an admin' });
  }
};

module.exports = { protect, admin };
